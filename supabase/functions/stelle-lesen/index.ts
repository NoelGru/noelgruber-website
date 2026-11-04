// stelle-lesen: liest Position und Unternehmen aus einer Stellenanzeige.
// Portierung des Parsers aus der lokalen Bewerbungsspur (server.mjs).
// Nur für angemeldete Nutzer: Das Gateway prüft das JWT (verify_jwt), hier wird
// zusätzlich verlangt, dass es eine echte Sitzung ist und kein anon-Schlüssel.

const ERLAUBT = [
  /^https:\/\/(www\.)?noelgruber\.de$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

function cors(origin: string | null): Record<string, string> {
  const ok = origin && ERLAUBT.some((re) => re.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "https://noelgruber.de",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/* ---------------- Text aufräumen ---------------- */

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", euro: "€",
};
function entschluesseln(s: string) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in ENTITIES ? ENTITIES[name] : m));
}
function sauber(s: unknown) {
  return entschluesseln(String(s || "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function ohneKuerzel(s: string) {
  return String(s || "")
    .replace(/[\(\[\{]\s*(?:m|w|d|f|x|a|all\s*genders?|gn|divers)(?:\s*[\/|,\-–]\s*(?:m|w|d|f|x|a|gn|divers))*\s*[\)\]\}]/gi, " ")
    .replace(/\b(?:m|w)\s*[\/|]\s*w?\s*[\/|]?\s*d\b/gi, " ")
    .replace(/\s*[-–—|]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const UNBRAUCHBAR = [
  /^\d{1,2}\.\s*\w+\.?\s*\d{4}$/,
  /^\d+\s*(treffer|jobs?|stellen)/i,
  /\{|\}|px;|font-|box-sizing/i,
  /^\s*$/,
];
function brauchbar(t: string) {
  if (!t || t.length > 140) return false;
  return !UNBRAUCHBAR.some((re) => re.test(t));
}

const PORTAL_WORT = /^(stepstone|indeed|linkedin|xing|jobs?|karriere|stellenangebote?|jobbörse|jobboerse|kununu|glassdoor|monster|jobware|arbeitsagentur|campingjobs|personio)$/i;

function titelTrennen(titel: string) {
  const teile = String(titel || "")
    .split(/\s+(?:bei|at)\s+|\s*[|•·–—]\s*|\s+-\s+/)
    .map((t) => sauber(t))
    .filter(Boolean)
    .filter((t) => !PORTAL_WORT.test(t))
    .filter(brauchbar);
  if (!teile.length) return { position: "", firma: "" };
  const position = ohneKuerzel(teile[0]);
  let firma = "";
  if (teile.length > 1) {
    const letzter = teile[teile.length - 1];
    if (letzter.length <= 60 && letzter !== teile[0]) firma = ohneKuerzel(letzter);
  }
  return { position, firma };
}

function firmaAusHost(host: string) {
  const weg = ["www", "de", "com", "net", "org", "eu", "at", "ch", "io", "co", "uk",
    "karriere", "jobs", "career", "careers", "stellen", "bewerbung", "recruiting", "apply"];
  const teile = host.split(".").filter((t) => !weg.includes(t));
  const name = teile[0] || host;
  return name.split("-").map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join("-");
}

/* ---------------- Anzeige auslesen ---------------- */

function ausJsonLd(html: string) {
  const treffer = { position: "", firma: "" };
  const blocks = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const roh = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    let daten: unknown;
    try { daten = JSON.parse(roh); } catch { continue; }
    const kandidaten: Record<string, unknown>[] = [];
    const sammeln = (x: unknown) => {
      if (!x || typeof x !== "object") return;
      if (Array.isArray(x)) return x.forEach(sammeln);
      const o = x as Record<string, unknown>;
      kandidaten.push(o);
      if (o["@graph"]) sammeln(o["@graph"]);
    };
    sammeln(daten);
    for (const k of kandidaten) {
      if (String(k["@type"] || "").toLowerCase() !== "jobposting") continue;
      if (k.title) treffer.position = ohneKuerzel(sauber(k.title));
      const org = k.hiringOrganization as unknown;
      if (typeof org === "string") treffer.firma = sauber(org);
      else if (org && typeof org === "object" && (org as { name?: string }).name) {
        treffer.firma = sauber((org as { name: string }).name);
      }
      if (treffer.position) return treffer;
    }
  }
  return treffer;
}

function metaInhalt(html: string, name: string) {
  const re = new RegExp('<meta[^>]+(?:property|name)\\s*=\\s*["\']' + name + '["\'][^>]*>', "i");
  const tag = (html.match(re) || [])[0];
  if (!tag) return "";
  const inhalt = tag.match(/content\s*=\s*["']([^"']*)["']/i);
  return inhalt ? sauber(inhalt[1]) : "";
}

// Keine Adressen im eigenen Netz abrufen
function erlaubteAdresse(u: URL) {
  if (!/^https?:$/.test(u.protocol)) return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return false;
  if (/^\[.*\]$/.test(h)) return false; // IPv6-Literale
  const ip = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ip) {
    const [a, b] = [+ip[1], +ip[2]];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false;
  }
  return true;
}

async function anzeigeLesen(url: string) {
  const antwort = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "de-DE,de;q=0.9,en;q=0.8" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!antwort.ok) {
    const grund = antwort.status === 403 || antwort.status === 429
      ? "Die Seite blockiert automatische Zugriffe"
      : "Die Seite antwortet mit " + antwort.status;
    return { fehler: grund };
  }
  const html = (await antwort.text()).slice(0, 4_000_000);
  const host = new URL(antwort.url || url).hostname.replace(/^www\./, "");

  const ld = ausJsonLd(html);
  let position = ld.position;
  let firma = ld.firma;

  const rein = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const h1 = sauber((rein.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "");
  const ogTitel = metaInhalt(rein, "og:title");
  const seitenTitel = sauber((rein.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");

  if (!position && /\b\d+\s*(treffer|jobs?\b|stellenangebote)/i.test(seitenTitel + " " + h1)) {
    return { position: "", firma: "", host, fehler: "Das ist eine Trefferliste, bitte den Link der einzelnen Anzeige einfügen" };
  }

  if (!position && brauchbar(h1)) position = ohneKuerzel(h1);
  if (!position || !firma) {
    for (const quelle of [ogTitel, seitenTitel]) {
      if (!quelle) continue;
      const t = titelTrennen(quelle);
      if (!position && t.position) position = t.position;
      if (!firma && t.firma) firma = t.firma;
      if (position && firma) break;
    }
  }

  if (!firma) firma = metaInhalt(html, "og:site_name");
  if (firma && (PORTAL_WORT.test(firma) || !brauchbar(firma))) firma = "";
  if (!firma) firma = firmaAusHost(host);

  if (position && position.length > 120) position = position.slice(0, 120).trim();
  return { position: position || "", firma: firma || "", host };
}

/* ---------------- Anfrage ---------------- */

function rolleAusJwt(auth: string | null) {
  try {
    const token = (auth || "").replace(/^Bearer\s+/i, "");
    const teil = token.split(".")[1];
    const json = JSON.parse(atob(teil.replace(/-/g, "+").replace(/_/g, "/")));
    return { rolle: String(json.role || ""), sub: String(json.sub || "") };
  } catch {
    return { rolle: "", sub: "" };
  }
}

Deno.serve(async (req) => {
  const kopf = cors(req.headers.get("Origin"));
  const antwort = (code: number, daten: unknown) =>
    new Response(JSON.stringify(daten), { status: code, headers: { ...kopf, "Content-Type": "application/json; charset=utf-8" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: kopf });
  if (req.method !== "POST") return antwort(405, { fehler: "Nur POST" });

  const { rolle, sub } = rolleAusJwt(req.headers.get("Authorization"));
  if (rolle !== "authenticated" || !sub) return antwort(401, { fehler: "Bitte anmelden" });

  let url = "";
  try { url = String((await req.json()).url || "").trim(); } catch { /* leer */ }
  let adresse: URL;
  try { adresse = new URL(url); } catch { return antwort(400, { fehler: "Das ist keine Web-Adresse" }); }
  if (!erlaubteAdresse(adresse)) return antwort(400, { fehler: "Diese Adresse lässt sich nicht lesen" });

  try {
    return antwort(200, await anzeigeLesen(adresse.href));
  } catch (e) {
    const langsam = e instanceof Error && e.name === "TimeoutError";
    return antwort(200, { fehler: langsam ? "Die Anzeige hat zu lange gebraucht" : "Die Anzeige war nicht erreichbar" });
  }
});
