/* Liefert /touren/<tour> aus: dieselbe Seite wie /touren, aber mit Titel, Beschreibung und
   Vorschaubild der jeweiligen Tour. So zeigen geteilte Links in WhatsApp & Co. eine Vorschau.
   Die Tourdaten sind ohnehin öffentlich lesbar, der Schlüssel ist der öffentliche (publishable). */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SB_URL = 'https://beugtfvyoseobcevaqmu.supabase.co';
const SB_KEY = 'sb_publishable_3Cy7Pi8f1eOzoMU-WOaBGA_g3JuoUv5';
const SEITE = 'https://noelgruber.de/touren';
const vorlage = readFileSync(join(process.cwd(), 'touren', 'index.html'), 'utf8');

export default async function handler(req, res) {
  const slug = String(req.query.slug || '');
  let tour = null;
  if (/^[a-z0-9][a-z0-9-]{0,59}$/.test(slug)) {
    try {
      const antwort = await fetch(`${SB_URL}/rest/v1/tours?id=eq.${slug}&select=id,data`, { headers: { apikey: SB_KEY } });
      if (antwort.ok) tour = (await antwort.json())[0] || null;
    } catch (fehler) {
      console.error('Tour konnte nicht geladen werden:', fehler);
    }
  }

  let html = vorlage;
  if (tour) html = html.replace(/<!--META-->[\s\S]*?<!--\/META-->/, meta(tour.id, tour.data || {}));

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  return res.status(tour ? 200 : 404).send(html);
}

function meta(id, t) {
  const zahl = (n, d = 0) => Number(n).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const schwer = { blau: 'Leicht', rot: 'Mittel', schwarz: 'Schwer' }[t.difficulty];
  const teile = [
    t.distanceKm != null && `${zahl(t.distanceKm, 1)} km`,
    t.ascentM != null && `${zahl(t.ascentM)} Hm`,
    t.durationH != null && `${zahl(t.durationH, t.durationH % 1 ? 1 : 0)} Std.`,
    schwer,
    t.region,
  ].filter(Boolean);
  const titel = `${t.name || 'Tour'} · Tourenbuch`;
  const text = teile.join(' · ') || 'Eine Wanderung aus meinem Tourenbuch.';
  const url = `${SEITE}/${id}`;
  const bild = Array.isArray(t.photos) && t.photos[0]
    ? `${SB_URL}/storage/v1/object/public/fotos/${String(t.photos[0]).split('/').map(encodeURIComponent).join('/')}`
    : null;
  return [
    `<title>${esc(titel)}</title>`,
    `<meta name="description" content="${esc(text)}">`,
    '<meta property="og:type" content="article">',
    '<meta property="og:site_name" content="Noel Gruber">',
    '<meta property="og:locale" content="de_DE">',
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:title" content="${esc(t.name || 'Tour')}">`,
    `<meta property="og:description" content="${esc(text)}">`,
    bild && `<meta property="og:image" content="${esc(bild)}">`,
    `<meta name="twitter:card" content="${bild ? 'summary_large_image' : 'summary'}">`,
    `<link rel="canonical" href="${esc(url)}">`,
  ].filter(Boolean).join('\n');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
