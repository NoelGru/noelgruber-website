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
  bestaetigt: { label: 'Eingang bestätigt', offen: true  },
  interview:  { label: 'Interview',         offen: true  },
  zusage:     { label: 'Zusage',            offen: false },
  absage:     { label: 'Absage',            offen: false },
  still:      { label: 'Keine Rückmeldung', offen: false },
};
const KEYS = Object.keys(STATUS);
const farbe = k => `var(--s-${k})`;
const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const state = { sb: null, user: null, items: [], filter: 'alle', q: '', sort: 'neu', editId: null, frageId: null };

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
    $('#liste').innerHTML = ''; $('#zahlen').innerHTML = ''; $('#balken').innerHTML = ''; $('#legende').innerHTML = '';
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
  linkNote: $('#link-note'), note: $('#form-note'), speichern: $('#speichern'), abbrechen: $('#abbrechen'),
  titel: $('#form-titel'), mono: $('#form-mono'), auslesen: $('#auslesen'),
};
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
f.url.addEventListener('input', () => {
  if (text(f.url.value)) f.form.classList.add('offen');
  clearTimeout(lesenTimer); lesenTimer = setTimeout(() => auslesen(false), 450);
});
$('#von-hand').addEventListener('click', () => { f.form.classList.add('offen'); f.firma.focus(); });
f.auslesen.addEventListener('click', () => { clearTimeout(lesenTimer); auslesen(true); });

/* ---------- Formular ---------- */
function formLeeren() {
  f.form.reset();
  f.datum.value = heute();
  f.status.value = 'beworben';
  zuletztGelesen = ''; state.editId = null;
  f.titel.textContent = 'Bewerbung eintragen'; f.mono.textContent = 'Neu';
  f.speichern.textContent = 'Eintragen'; f.abbrechen.hidden = true;
  f.form.classList.remove('offen');
  hinweis(f.linkNote, LINK_STANDARD); hinweis(f.note, '');
}

function formFuellen(i) {
  state.editId = i.id; state.frageId = null;
  f.url.value = i.url || ''; zuletztGelesen = i.url ? alsLink(i.url) : '';
  f.firma.value = i.firma || ''; f.position.value = i.position || '';
  f.datum.value = i.beworben_am || heute(); f.status.value = STATUS[i.status] ? i.status : 'beworben';
  f.canva.value = i.canva_url || ''; f.notiz.value = i.notiz || '';
  f.titel.textContent = i.firma || 'Bewerbung'; f.mono.textContent = 'Bearbeiten';
  f.speichern.textContent = 'Änderungen speichern'; f.abbrechen.hidden = false;
  f.form.classList.add('offen');
  hinweis(f.linkNote, LINK_STANDARD); hinweis(f.note, '');
  renderListe();
  f.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => f.firma.focus({ preventScroll: true }), 350);
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
    hinweis(f.note, 'Bitte Firma oder Position eintragen, oder oben den Link einfügen.', 'err');
    f.firma.focus(); return;
  }
  if (canva && !werte.canva_url) { hinweis(f.note, 'Der Canva-Link sieht nicht vollständig aus.', 'err'); f.canva.focus(); return; }
  f.speichern.disabled = true;
  const warEdit = !!state.editId;
  try {
    await speichern(werte, state.editId);
    formLeeren(); render();
    melden(warEdit ? 'Änderungen gespeichert.' : 'Eingetragen.');
  } catch {
    hinweis(f.note, 'Speichern hat nicht geklappt. Bist du noch angemeldet?', 'err');
  }
  f.speichern.disabled = false;
});
f.abbrechen.addEventListener('click', () => { formLeeren(); renderListe(); });

/* ---------- Auswahl ---------- */
function sichtbar() {
  const q = state.q.toLowerCase();
  const items = state.items.filter(i => {
    if (state.filter === 'offen' && !offen(i)) return false;
    if (STATUS[state.filter] && i.status !== state.filter) return false;
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
function render() { renderKopf(); renderChips(); renderListe(); }

function renderKopf() {
  const items = state.items, n = items.length;
  const laufend = items.filter(offen).length;
  const gespraeche = items.filter(i => i.status === 'interview' || i.status === 'zusage').length;
  const antworten = items.filter(i => ['bestaetigt', 'interview', 'zusage', 'absage'].includes(i.status)).length;
  const quote = n ? Math.round(antworten / n * 100) : 0;

  $('#titel').innerHTML = n
    ? `${esc(plural(n, 'Bewerbung', 'Bewerbungen'))}, <span class="ser">${laufend} laufend</span>.`
    : 'Noch keine <span class="ser">Bewerbungen</span>.';

  $('#zahlen').innerHTML = [
    [n, 'erfasst'], [laufend, 'laufend'], [gespraeche, plural(gespraeche, 'Gespräch', 'Gespräche').replace(/^\d+ /, '')], [`${quote} %`, 'Rückmeldequote'],
  ].map(([z, l]) => `<div><b>${z}</b><span>${l}</span></div>`).join('');

  const c = Object.fromEntries(KEYS.map(k => [k, items.filter(i => i.status === k).length]));
  $('#verteilung').hidden = !n;
  $('#balken').innerHTML = KEYS.filter(k => c[k]).map(k =>
    `<button type="button" data-filter="${k}" style="flex:${c[k]};background:${farbe(k)}" title="${STATUS[k].label}: ${c[k]}" aria-label="Nur ${STATUS[k].label} zeigen (${c[k]})"></button>`).join('');
  $('#legende').innerHTML = KEYS.map(k =>
    `<button type="button" data-filter="${k}" aria-pressed="${state.filter === k}"${c[k] ? '' : ' class="leer"'}><i class="bw-punkt" style="background:${farbe(k)}"></i>${STATUS[k].label} <b>${c[k]}</b></button>`).join('');
}

function renderChips() {
  $('#chips').innerHTML = [['alle', 'Alle'], ['offen', 'Laufend']].map(([k, l]) =>
    `<button type="button" class="bw-chip" data-filter="${k}" aria-pressed="${state.filter === k}">${l}</button>`).join('');
  legendeMarkieren();
}
function legendeMarkieren() {
  document.querySelectorAll('#legende [data-filter]').forEach(b => b.setAttribute('aria-pressed', String(state.filter === b.dataset.filter)));
}

function renderListe() {
  const items = sichtbar(), liste = $('#liste');
  const gefiltert = state.filter !== 'alle' || state.q;
  const filterName = state.filter === 'offen' ? 'laufend' : STATUS[state.filter] ? `„${STATUS[state.filter].label}“` : '';
  $('#auswahl').textContent = state.items.length
    ? (gefiltert ? `${items.length} von ${state.items.length} angezeigt${filterName ? ', Filter: ' + filterName : ''}${state.q ? `, Suche: „${state.q}“` : ''}` : `${plural(items.length, 'Eintrag', 'Einträge')}`) + ' · Der Export enthält genau diese Auswahl.'
    : '';

  if (!items.length) {
    liste.innerHTML = state.items.length
      ? '<div class="bw-leer"><b>Keine Treffer</b>Für diese Auswahl gibt es keine Einträge.</div>'
      : '<div class="bw-leer"><b>Noch nichts erfasst</b>Oben den Link einer Anzeige einfügen, der Rest kommt von allein.</div>';
    return;
  }
  if (state.sort === 'firma') { liste.innerHTML = `<div class="bw-reihen bw-reihen--flach">${items.map(reihe).join('')}</div>`; return; }

  const gruppen = [];
  for (const i of items) {
    const d = datum(i.beworben_am), key = d ? `${d.getFullYear()}-${d.getMonth()}` : 'ohne';
    let g = gruppen[gruppen.length - 1];
    if (!g || g.key !== key) gruppen.push(g = { key, name: d ? `${MONATE[d.getMonth()]} ${d.getFullYear()}` : 'Ohne Datum', items: [] });
    g.items.push(i);
  }
  liste.innerHTML = gruppen.map(g =>
    `<div class="bw-monat"><h3>${g.name}</h3><span>${plural(g.items.length, 'Bewerbung', 'Bewerbungen')}</span></div><div class="bw-reihen">${g.items.map(reihe).join('')}</div>`).join('');
}

function reihe(i) {
  const link = sicher(i.url), canva = sicher(i.canva_url);
  const name = esc(i.firma || host(link) || 'Ohne Firma');
  const firma = link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${name}<span aria-hidden="true">↗</span></a>` : name;
  const tage = tageHer(i.beworben_am);
  const wann = tage == null ? '' : tage === 0 ? 'heute' : tage < 0 ? `in ${plural(-tage, 'Tag', 'Tagen')}` : `vor ${plural(tage, 'Tag', 'Tagen')}`;
  const k = STATUS[i.status] ? i.status : 'beworben';
  const extra = [
    canva && `<a href="${esc(canva)}" target="_blank" rel="noopener noreferrer">Canva ↗</a>`,
    i.notiz && `<span class="bw-notiz">${esc(i.notiz)}</span>`,
  ].filter(Boolean).join('');
  const aktionen = state.frageId === i.id
    ? `<span class="bw-frage">Löschen?</span><button type="button" class="bw-knopf bw-knopf--weg" data-akt="ja" data-id="${i.id}" aria-label="Ja, ${name} löschen">Ja</button><button type="button" class="bw-knopf" data-akt="nein">Nein</button>`
    : `<button type="button" class="bw-knopf" data-akt="bearbeiten" data-id="${i.id}">Bearbeiten</button><button type="button" class="bw-knopf" data-akt="frage" data-id="${i.id}" aria-label="${name} löschen">Löschen</button>`;
  return `<article class="bw-eintrag${state.editId === i.id ? ' bearbeitet' : ''}">
    <div><div class="bw-firma">${firma}</div><div class="bw-position">${esc(i.position || '–')}</div>${extra ? `<div class="bw-extra">${extra}</div>` : ''}</div>
    <div class="bw-datum">${fmt(i.beworben_am)}${wann ? `<small>${wann}</small>` : ''}</div>
    <div><select class="bw-status" data-id="${i.id}" style="--farbe:${farbe(k)}" aria-label="Status für ${name}">${KEYS.map(s => `<option value="${s}"${s === k ? ' selected' : ''}>${STATUS[s].label}</option>`).join('')}</select></div>
    <div class="bw-aktionen">${aktionen}</div>
  </article>`;
}

/* ---------- Ereignisse ---------- */
function filterKlick(e) {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  const v = b.dataset.filter;
  state.filter = state.filter === v && v !== 'alle' ? 'alle' : v;
  renderChips(); renderListe();
}
['#chips', '#legende', '#balken'].forEach(s => $(s).addEventListener('click', filterKlick));
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
      if (state.editId === id) formLeeren();
      render(); melden('Gelöscht.');
    } catch { renderListe(); melden('Löschen hat nicht geklappt.'); }
  }
});

$('#liste').addEventListener('change', async e => {
  const sel = e.target.closest('select.bw-status');
  if (!sel) return;
  const id = sel.dataset.id, alt = state.items.find(i => i.id === id);
  if (!alt) return;
  sel.style.setProperty('--farbe', farbe(sel.value));
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
