/* Bewerbungen: private Übersicht, nur nach Anmeldung.
   Daten liegen in Supabase (Tabelle bewerbungen, Row Level Security: nur eigene Zeilen).
   Ohne Sitzung wird nichts geladen, die Seite enthält selbst keine Daten. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const SB_URL = 'https://beugtfvyoseobcevaqmu.supabase.co';
const SB_KEY = 'sb_publishable_3Cy7Pi8f1eOzoMU-WOaBGA_g3JuoUv5';
const SPALTEN = 'id,firma,position,url,beworben_am,status,notiz,canva_url,created_at';

const STATUS = {
  beworben:   { label: 'Beworben',          offen: true  },
  interview:  { label: 'Interview',         offen: true  },
  zusage:     { label: 'Zusage',            offen: false },
  absage:     { label: 'Absage',            offen: false },
  still:      { label: 'Keine Rückmeldung', offen: false },
};
const KEYS = Object.keys(STATUS);
// Links der Bewerbungsweg, rechts was ohne Zusage endete
const WEG = ['beworben', 'interview', 'zusage'];
const ENDE = ['absage', 'still'];
const REITER = [
  ['laufend', 'Laufend', i => STATUS[i.status]?.offen],
  ['gespraeche', 'Interviews', i => i.status === 'interview' || i.status === 'zusage'],
  ['zu', 'Abgeschlossen', i => i.status === 'absage' || i.status === 'still'],
  ['alle', 'Alle', () => true],
];
const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const state = { sb: null, user: null, items: [], reiter: 'laufend', status: null, q: '', sort: 'neu', editId: null, frageId: null };

/* ---------- Hilfen ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const text = v => (v == null ? '' : String(v)).trim();
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const heute = () => iso(new Date());
const datum = s => { if (!s) return null; const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = s => { const d = datum(s); return d ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}` : '–'; };
const tageHer = s => { const d = datum(s); return d ? Math.round((datum(heute()) - d) / 864e5) : null; };
const plural = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;
const sicher = u => (/^https?:\/\//i.test(text(u)) ? text(u) : '');
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const istLink = s => /^[a-z][a-z0-9+.-]*:\/\//i.test(s) || (/^[\w.-]+\.[a-z]{2,}(\/|$|\?)/i.test(s) && !/\s/.test(s));
const alsLink = s => { const u = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'https://' + s; try { return new URL(u).href; } catch { return ''; } };
const offen = i => (STATUS[i.status] || {}).offen;

let meldeTimer;
function melden(m) {
  let el = $('#meldung');
  if (!el) { el = document.createElement('div'); el.id = 'meldung'; el.className = 'bw-meldung'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = m; el.hidden = false;
  clearTimeout(meldeTimer); meldeTimer = setTimeout(() => { el.hidden = true; }, 2600);
}
function hinweis(el, m, art) { el.textContent = m; el.className = 'fnote' + (art ? ' ' + art : ''); }
function blitz(el) { el.classList.remove('bw-blitz'); void el.offsetWidth; el.classList.add('bw-blitz'); }

/* ---------- Ansichten ---------- */
function zeige(welche) {
  $('#ansicht-laden').hidden = welche !== 'laden';
  $('#ansicht-login').hidden = welche !== 'login';
  $('#ansicht-app').hidden = welche !== 'app';
  $('#abmelden').hidden = welche !== 'app';
}

async function setUser(u) {
  const vorher = state.user && state.user.id;
  state.user = u;
  if (!u) {
    state.items = []; state.editId = null; state.frageId = null;
    fensterZu();
    ['#liste', '#pipe', '#quote', '#reiter', '#filterchip', '#auswahl'].forEach(s => { $(s).innerHTML = ''; });
    zeige('login');
    return;
  }
  zeige('app');
  if (vorher !== u.id) await laden();
}

/* ---------- Daten ---------- */
async function laden() {
  const { data, error } = await state.sb.from('bewerbungen').select(SPALTEN).order('beworben_am', { ascending: false });
  if (error) { melden('Laden hat nicht geklappt.'); state.items = []; }
  else state.items = data || [];
  render();
}

async function speichern(werte, id) {
  if (id) {
    const { data, error } = await state.sb.from('bewerbungen').update(werte).eq('id', id).select(SPALTEN).single();
    if (error) throw error;
    state.items = state.items.map(i => (i.id === id ? data : i));
    return data;
  }
  const { data, error } = await state.sb.from('bewerbungen').insert(werte).select(SPALTEN).single();
  if (error) throw error;
  state.items.push(data);
  return data;
}

async function loeschen(id) {
  const { error } = await state.sb.from('bewerbungen').delete().eq('id', id);
  if (error) throw error;
  state.items = state.items.filter(i => i.id !== id);
}

/* ---------- Anzeige auslesen ---------- */
const f = {
  form: $('#eintrag-form'), url: $('#f-url'), firma: $('#f-firma'), position: $('#f-position'),
  datum: $('#f-datum'), status: $('#f-status'), canva: $('#f-canva'), notiz: $('#f-notiz'),
  linkNote: $('#link-note'), note: $('#form-note'), speichern: $('#speichern'), mehr: $('#mehr'),
  titel: $('#form-titel'), mono: $('#form-mono'), auslesen: $('#auslesen'),
};
const fenster = $('#fenster'), overlay = $('#overlay');
let vorherFokus = null;

function fensterAuf(fokus) {
  vorherFokus = document.activeElement;
  fenster.hidden = false; overlay.hidden = false;
  document.body.classList.add('bw-gesperrt');
  fenster.scrollTop = 0;
  (fokus || f.url).focus();
}
function fensterZu() {
  if (fenster.hidden) return;
  fenster.hidden = true; overlay.hidden = true;
  document.body.classList.remove('bw-gesperrt');
  formLeeren(); renderListe();
  if (vorherFokus && document.contains(vorherFokus)) vorherFokus.focus();
}
$('#neu').addEventListener('click', () => { formLeeren(); fensterAuf(); });
$('#schliessen').addEventListener('click', fensterZu);
overlay.addEventListener('click', fensterZu);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !fenster.hidden) fensterZu(); });
f.status.innerHTML = KEYS.map(k => `<option value="${k}">${STATUS[k].label}</option>`).join('');
const LINK_STANDARD = f.linkNote.textContent;
let zuletztGelesen = '', lesenTimer;

function einsetzen(w) {
  const gefuellt = [];
  for (const k of ['firma', 'position']) {
    const v = text(w[k]);
    if (v && !text(f[k].value)) { f[k].value = v; blitz(f[k]); gefuellt.push(k); }
  }
  return gefuellt;
}

// Ohne Link: als Überschrift lesen, z. B. "Marketing Manager (m/w/d) – Firma GmbH"
function ausTitel(roh) {
  const t = text(roh).replace(/\s*[-–—|]\s*(stellenangebot|stellenanzeige|jobs?|karriere|stepstone|indeed|linkedin|xing)\b.*$/i, '');
  const teile = t.split(/\s+(?:bei|at)\s+|\s*[|–—]\s*|\s+-\s+/).map(text).filter(Boolean);
  const position = (teile[0] || t).replace(/[\(\[]\s*(?:m|w|d|f|x|all genders)[\/|,\s\-]*.*?[\)\]]/gi, ' ').replace(/\s{2,}/g, ' ').trim();
  const firma = teile.length > 1 && teile[teile.length - 1].length <= 60 ? teile[teile.length - 1] : '';
  return { position, firma };
}

async function auslesen(erzwingen) {
  const roh = text(f.url.value);
  if (!roh) { hinweis(f.linkNote, LINK_STANDARD); return; }
  if (!istLink(roh)) {
    const g = einsetzen(ausTitel(roh));
    hinweis(f.linkNote, g.length ? 'Als Überschrift gelesen, bitte kurz prüfen.' : 'Firma und Position sind schon ausgefüllt.', g.length ? 'ok' : '');
    return;
  }
  const url = alsLink(roh);
  if (!url) { hinweis(f.linkNote, 'Diese Adresse lässt sich nicht lesen.', 'err'); return; }
  if (!erzwingen && url === zuletztGelesen) return;
  zuletztGelesen = url;
  f.form.classList.add('liest'); f.auslesen.disabled = true; f.auslesen.textContent = 'Liest …';
  hinweis(f.linkNote, `Öffnet ${host(url)} …`);
  try {
    const { data, error } = await state.sb.functions.invoke('stelle-lesen', { body: { url } });
    if (error) throw error;
    if (data.fehler) {
      hinweis(f.linkNote, `${data.fehler}. Firma und Position bitte von Hand eintragen.`, 'err');
    } else {
      const g = einsetzen(data);
      hinweis(f.linkNote, g.length ? `Aus der Anzeige gelesen (${data.host}). Bitte kurz prüfen.` : 'Gelesen, die Felder waren schon ausgefüllt.', 'ok');
    }
  } catch {
    hinweis(f.linkNote, 'Auslesen hat nicht geklappt. Firma und Position bitte von Hand eintragen.', 'err');
  }
  f.form.classList.remove('liest'); f.auslesen.disabled = false; f.auslesen.textContent = 'Auslesen';
}
f.url.addEventListener('input', () => { clearTimeout(lesenTimer); lesenTimer = setTimeout(() => auslesen(false), 450); });
f.auslesen.addEventListener('click', () => { clearTimeout(lesenTimer); auslesen(true); });

/* ---------- Formular ---------- */
function formLeeren() {
  f.form.reset();
  f.datum.value = heute();
  f.status.value = 'beworben';
  zuletztGelesen = ''; state.editId = null;
  f.titel.textContent = 'Bewerbung eintragen'; f.mono.textContent = 'Neu';
  f.speichern.textContent = 'Eintragen'; f.mehr.open = false;
  hinweis(f.linkNote, LINK_STANDARD); hinweis(f.note, '');
}

function formFuellen(i) {
  state.editId = i.id; state.frageId = null;
  f.url.value = i.url || ''; zuletztGelesen = i.url ? alsLink(i.url) : '';
  f.firma.value = i.firma || ''; f.position.value = i.position || '';
  f.datum.value = i.beworben_am || heute(); f.status.value = STATUS[i.status] ? i.status : 'beworben';
  f.canva.value = i.canva_url || ''; f.notiz.value = i.notiz || '';
  f.titel.textContent = i.firma || 'Bewerbung'; f.mono.textContent = 'Bearbeiten';
  f.speichern.textContent = 'Änderungen speichern'; f.mehr.open = true;
  hinweis(f.linkNote, LINK_STANDARD); hinweis(f.note, '');
  renderListe();
  fensterAuf(f.firma);
}

f.form.addEventListener('submit', async e => {
  e.preventDefault();
  const roh = text(f.url.value);
  const canva = text(f.canva.value);
  const werte = {
    firma: text(f.firma.value) || null,
    position: text(f.position.value) || null,
    url: roh && istLink(roh) ? alsLink(roh) || null : null,
    beworben_am: f.datum.value || heute(),
    status: f.status.value,
    canva_url: canva ? alsLink(canva) || null : null,
    notiz: text(f.notiz.value) || null,
  };
  if (!werte.firma && !werte.position) {
    hinweis(f.note, 'Bitte Firma oder Position eintragen oder oben den Link einfügen.', 'err');
    f.firma.focus(); return;
  }
  if (canva && !werte.canva_url) { f.mehr.open = true; hinweis(f.note, 'Der Canva-Link sieht nicht vollständig aus.', 'err'); f.canva.focus(); return; }
  f.speichern.disabled = true;
  const warEdit = !!state.editId;
  try {
    await speichern(werte, state.editId);
    fensterZu(); render();
    melden(warEdit ? 'Änderungen gespeichert.' : 'Eingetragen.');
  } catch {
    hinweis(f.note, 'Speichern hat nicht geklappt. Bist du noch angemeldet?', 'err');
  }
  f.speichern.disabled = false;
});

/* ---------- Auswahl ---------- */
function sichtbar() {
  const q = state.q.toLowerCase();
  const imReiter = REITER.find(r => r[0] === state.reiter)[2];
  const items = state.items.filter(i => {
    if (state.status ? i.status !== state.status : !imReiter(i)) return false;
    return !q || `${i.firma || ''} ${i.position || ''} ${i.notiz || ''}`.toLowerCase().includes(q);
  });
  const nachDatum = (a, b) => (a.beworben_am || '').localeCompare(b.beworben_am || '') || (a.created_at || '').localeCompare(b.created_at || '');
  items.sort((a, b) => {
    if (state.sort === 'firma') return (a.firma || '').localeCompare(b.firma || '', 'de', { sensitivity: 'base' }) || nachDatum(b, a);
    return state.sort === 'alt' ? nachDatum(a, b) : nachDatum(b, a);
  });
  return items;
}

/* ---------- Rendern ---------- */
function render() { renderKopf(); renderReiter(); renderListe(); }

function renderKopf() {
  const items = state.items, n = items.length;
  const laufend = items.filter(offen).length;
  const gespraeche = items.filter(i => i.status === 'interview' || i.status === 'zusage').length;
  const antworten = items.filter(i => ['interview', 'zusage', 'absage'].includes(i.status)).length;
  const quote = n ? Math.round(antworten / n * 100) : 0;
  const c = Object.fromEntries(KEYS.map(k => [k, items.filter(i => i.status === k).length]));
  const anteil = k => (n ? Math.round(c[k] / n * 100) : 0);

  $('#titel').innerHTML = n
    ? `${esc(plural(n, 'Bewerbung', 'Bewerbungen'))}, <span class="ser">${laufend} laufend</span>.`
    : 'Noch keine <span class="ser">Bewerbungen</span>.';

  const karte = (k, pfeil) =>
    `<button type="button" class="bw-stufe${pfeil ? ' bw-stufe--pfeil' : ''}" data-s="${k}" data-status="${k}" aria-pressed="${state.status === k}">
      <b>${c[k]}</b><span>${STATUS[k].label}</span><small>${k === 'beworben' ? 'warten auf Antwort' : `${anteil(k)} % aller Bewerbungen`}</small></button>`;
  const summe = ks => ks.reduce((a, k) => a + c[k], 0);
  const gruppe = (titel, ks, pfeile, art) =>
    `<div class="bw-gruppe bw-gruppe--${art}"><p class="bw-gruppe__titel">${titel}<b>${summe(ks)}</b></p>
      <div class="bw-gruppe__karten">${ks.map((k, i) => karte(k, pfeile && i < ks.length - 1)).join('')}</div></div>`;
  $('#pipe').innerHTML = gruppe('Bewerbungsweg', WEG, true, 'weg') + gruppe('Abgeschlossen', ENDE, false, 'ende');
  $('#quote').innerHTML = n ? `Rückmeldequote <b>${quote} %</b> · ${plural(gespraeche, 'Gespräch', 'Gespräche')}` : '';
}

function renderReiter() {
  $('#reiter').innerHTML = REITER.map(([k, l, fn]) =>
    `<button type="button" data-reiter="${k}" aria-pressed="${!state.status && state.reiter === k}">${l}<b>${state.items.filter(fn).length}</b></button>`).join('');
  $('#filterchip').innerHTML = state.status
    ? `<button type="button" class="bw-filterchip" data-s="${state.status}" data-status="${state.status}" aria-label="Filter ${STATUS[state.status].label} aufheben">Nur ${STATUS[state.status].label} ✕</button>`
    : '';
  document.querySelectorAll('#pipe [data-status]').forEach(b => b.setAttribute('aria-pressed', String(state.status === b.dataset.status)));
}

function renderListe() {
  const items = sichtbar(), liste = $('#liste');
  $('#auswahl').textContent = state.items.length
    ? `${plural(items.length, 'Eintrag', 'Einträge')}${state.q ? ` für „${state.q}“` : ''} · Der Export enthält genau diese Auswahl.`
    : '';

  if (!items.length) {
    liste.innerHTML = state.items.length
      ? '<div class="bw-leer"><b>Keine Treffer</b>Für diese Auswahl gibt es keine Einträge.</div>'
      : '<div class="bw-leer"><b>Noch nichts erfasst</b>Über „Neue Bewerbung“ den Link einer Anzeige einfügen, der Rest kommt von allein.</div>';
    return;
  }
  const kopf = '<div class="bw-zeile bw-spaltenkopf" aria-hidden="true"><div>Status</div><div>Firma</div><div>Position</div><div>Datum</div><div></div></div>';
  if (state.sort === 'firma') { liste.innerHTML = kopf + items.map(zeile).join(''); return; }

  let html = kopf, letzter = null;
  for (const i of items) {
    const d = datum(i.beworben_am), key = d ? `${d.getFullYear()}-${d.getMonth()}` : 'ohne';
    if (key !== letzter) {
      letzter = key;
      const n = items.filter(x => { const xd = datum(x.beworben_am); return (xd ? `${xd.getFullYear()}-${xd.getMonth()}` : 'ohne') === key; }).length;
      html += `<div class="bw-monatszeile"><h3>${d ? `${MONATE[d.getMonth()]} ${d.getFullYear()}` : 'Ohne Datum'}</h3><span>${plural(n, 'Bewerbung', 'Bewerbungen')}</span></div>`;
    }
    html += zeile(i);
  }
  liste.innerHTML = html;
}

function zeile(i) {
  const link = sicher(i.url), canva = sicher(i.canva_url);
  const name = esc(i.firma || host(link) || 'Ohne Firma');
  const firma = link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${name}<span aria-hidden="true">↗</span></a>` : name;
  const tage = tageHer(i.beworben_am);
  const wann = tage == null ? '' : tage === 0 ? 'heute' : tage < 0 ? `in ${plural(-tage, 'Tag', 'Tagen')}` : `vor ${plural(tage, 'Tag', 'Tagen')}`;
  const k = STATUS[i.status] ? i.status : 'beworben';
  const hervor = k === 'interview' || k === 'zusage';
  const aktionen = state.frageId === i.id
    ? `<span class="bw-frage">Löschen?</span><button type="button" class="bw-knopf bw-knopf--weg" data-akt="ja" data-id="${i.id}" aria-label="Ja, ${name} löschen">Ja</button><button type="button" class="bw-knopf" data-akt="nein">Nein</button>`
    : `<button type="button" class="bw-knopf" data-akt="bearbeiten" data-id="${i.id}">Bearbeiten</button><button type="button" class="bw-knopf" data-akt="frage" data-id="${i.id}" aria-label="${name} löschen">Löschen</button>`;
  return `<div class="bw-zeile${hervor ? ' bw-zeile--hervor' : ''}${state.editId === i.id ? ' bw-zeile--bearbeitet' : ''}" data-s="${k}">
    <div><select class="bw-status" data-s="${k}" data-id="${i.id}" aria-label="Status für ${name}">${KEYS.map(s => `<option value="${s}"${s === k ? ' selected' : ''}>${STATUS[s].label}</option>`).join('')}</select></div>
    <div><div class="bw-firma">${firma}</div>${canva ? `<a class="bw-canva" href="${esc(canva)}" target="_blank" rel="noopener noreferrer">Canva ↗</a>` : ''}</div>
    <div class="bw-position">${esc(i.position || '–')}${i.notiz ? `<span class="bw-notiz">${esc(i.notiz)}</span>` : ''}</div>
    <div class="bw-datum">${fmt(i.beworben_am)}${wann ? `<small>${wann}</small>` : ''}</div>
    <div class="bw-aktionen">${aktionen}</div>
  </div>`;
}

/* ---------- Ereignisse ---------- */
function statusKlick(e) {
  const b = e.target.closest('[data-status]');
  if (!b) return;
  state.status = state.status === b.dataset.status ? null : b.dataset.status;
  state.frageId = null;
  renderReiter(); renderListe();
}
$('#pipe').addEventListener('click', statusKlick);
$('#filterchip').addEventListener('click', statusKlick);
$('#reiter').addEventListener('click', e => {
  const b = e.target.closest('[data-reiter]');
  if (!b) return;
  state.reiter = b.dataset.reiter; state.status = null; state.frageId = null;
  renderReiter(); renderListe();
});
$('#suche').addEventListener('input', e => { state.q = e.target.value.trim(); renderListe(); });
$('#sortierung').addEventListener('change', e => { state.sort = e.target.value; renderListe(); });

$('#liste').addEventListener('click', async e => {
  const b = e.target.closest('[data-akt]');
  if (!b) return;
  const id = b.dataset.id, akt = b.dataset.akt, item = state.items.find(i => i.id === id);
  if (akt === 'bearbeiten' && item) formFuellen(item);
  else if (akt === 'frage') { state.frageId = id; renderListe(); }
  else if (akt === 'nein') { state.frageId = null; renderListe(); }
  else if (akt === 'ja') {
    state.frageId = null;
    try {
      await loeschen(id);
      render(); melden('Gelöscht.');
    } catch { renderListe(); melden('Löschen hat nicht geklappt.'); }
  }
});

$('#liste').addEventListener('change', async e => {
  const sel = e.target.closest('select.bw-status');
  if (!sel) return;
  const id = sel.dataset.id;
  if (!state.items.some(i => i.id === id)) return;
  sel.dataset.s = sel.value;
  try {
    await speichern({ status: sel.value }, id);
    render(); melden(`Status: ${STATUS[sel.value].label}`);
  } catch { render(); melden('Status konnte nicht gespeichert werden.'); }
});

/* ---------- Export ---------- */
$('#export').addEventListener('click', () => {
  const items = sichtbar();
  if (!items.length) { melden('Nichts zu exportieren.'); return; }
  const kopf = ['Firma', 'Position', 'Beworben am', 'Status', 'Link', 'Canva', 'Notiz'];
  const zeilen = items.map(i => [i.firma, i.position, i.beworben_am, (STATUS[i.status] || {}).label || i.status, i.url, i.canva_url, i.notiz]);
  // Führende = + - @ entschärfen, damit Excel nichts als Formel ausführt
  const zelle = v => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const csv = '﻿' + [kopf, ...zeilen].map(r => r.map(zelle).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `bewerbungen-${heute()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  melden(`${plural(items.length, 'Eintrag', 'Einträge')} exportiert.`);
});

/* ---------- Anmelden ---------- */
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const mail = text($('#login-mail').value).toLowerCase(), note = $('#login-note'), knopf = $('#login-senden');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { hinweis(note, 'Die E-Mail-Adresse sieht nicht vollständig aus.', 'err'); return; }
  if (!state.sb) return;
  knopf.disabled = true; hinweis(note, 'Wird gesendet …');
  const { error } = await state.sb.auth.signInWithOtp({
    email: mail,
    options: { emailRedirectTo: location.origin + '/bewerbungen', shouldCreateUser: false },
  });
  knopf.disabled = false;
  // Bewusst dieselbe Antwort für unbekannte Adressen: verrät nicht, wer ein Konto hat.
  if (error && error.status === 429) hinweis(note, 'Zu viele Versuche. Bitte in ein paar Minuten noch einmal.', 'err');
  else hinweis(note, 'Wenn die Adresse freigeschaltet ist, ist der Login-Link unterwegs. Öffne ihn auf diesem Gerät.', 'ok');
});
$('#abmelden').addEventListener('click', async () => { await state.sb.auth.signOut(); melden('Abgemeldet.'); });

/* ---------- Start ---------- */
function start() {
  formLeeren();
  if (!window.supabase) { zeige('login'); hinweis($('#login-note'), 'Die Anmeldung ist gerade nicht erreichbar.', 'err'); return; }
  state.sb = window.supabase.createClient(SB_URL, SB_KEY);
  state.sb.auth.onAuthStateChange((_e, session) => { setTimeout(() => setUser(session?.user || null), 0); });
  state.sb.auth.getSession().then(({ data }) => setUser(data.session?.user || null)).catch(() => zeige('login'));
}
start();
})();
