(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SB_URL = 'https://beugtfvyoseobcevaqmu.supabase.co';
const SB_KEY = 'sb_publishable_3Cy7Pi8f1eOzoMU-WOaBGA_g3JuoUv5';
const OWNER = 'noel.gruber98@gmail.com';
const BASE = '/touren';
const foto = p => `${SB_URL}/storage/v1/object/public/fotos/${String(p).split('/').map(encodeURIComponent).join('/')}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MUC = { lat: 48.1374, lng: 11.5755 };
const REGIONS = ['Ammergauer Alpen','Allgäuer Alpen','Berchtesgadener Alpen','Chiemgauer Alpen','Estergebirge','Karwendel','Mangfallgebirge','Schlierseer Berge','Tegernseer Berge','Walchensee & Kochel','Wetterstein & Garmisch','Voralpenland','Tirol'];
const DIFF = {
  blau: { label: 'Leicht', long: 'Leicht · blauer Bergweg' },
  rot: { label: 'Mittel', long: 'Mittel · roter Bergweg' },
  schwarz: { label: 'Schwer', long: 'Schwer · schwarzer Bergweg' },
};

const state = {
  sb: null, user: null, canEdit: false,
  hikes: [], loaded: false, slow: false, unavailable: false,
  view: 'list', prevView: 'list', scrollY: 0,
  filters: { q: '', oepnv: false, diff: new Set(), region: '' }, sort: 'date',
  openId: null, mapSel: null,
  form: null, lb: { photos: [], i: 0 },
};

/* ---------- Hilfsfunktionen ---------- */
const nf = (n, d = 0) => Number(n).toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d });
const has = v => v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && isNaN(v));
function hav(a, b) {
  const R = 6371, toR = x => x * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const fromMuc = h => has(h.lat) && has(h.lng) ? hav(MUC, { lat: h.lat, lng: h.lng }) : null;
function fmtDur(h) {
  if (!has(h)) return '';
  const whole = Math.floor(h), m = Math.round((h - whole) * 60);
  if (m === 0) return `${whole} Std.`;
  if (m === 30) return `${whole}½ Std.`;
  return `${whole}:${String(m).padStart(2, '0')} Std.`;
}
function parseDur(s) {
  s = String(s || '').trim();
  if (!s) return null;
  if (s.includes(':')) { const [h, m] = s.split(':').map(x => parseInt(x, 10) || 0); return h + m / 60; }
  const v = parseFloat(s.replace(',', '.'));
  return isNaN(v) ? null : v;
}
const durInput = h => { if (!has(h)) return ''; const w = Math.floor(h), m = Math.round((h - w) * 60); return `${w}:${String(m).padStart(2, '0')}`; };
const fmtDate = d => { if (!d) return ''; const x = new Date(d + 'T12:00:00'); return isNaN(x) ? d : x.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }); };
const stars = n => { n = Math.round(n || 0); if (!n) return ''; return `<span class="stars" aria-label="${n} von 5 Sternen">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`; };
const num = v => { const x = parseFloat(String(v).replace(',', '.')); return isNaN(x) ? null : x; };
const slug = s => (String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'tour');
const uniqueSlug = n => { const b = slug(n); let id = b, i = 2; while (byId(id)) id = `${b}-${i++}`; return id; };
const byId = id => state.hikes.find(h => h.id === id);
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2400); }
function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- Silhouette als Platzhalterbild ---------- */
function silhouette(h) {
  const r = rng(hashStr(h.id || h.name || 'x'));
  const W = 400, H = 225;
  const layer = (base, amp, jag, n) => {
    const ph = [r() * 6, r() * 6]; const f = [1 + r() * 1.5, 3 + r() * 3]; let d = `M0 ${H}`;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = base - amp * (.55 + .3 * Math.sin(t * Math.PI * f[0] + ph[0]) + .15 * Math.sin(t * Math.PI * f[1] + ph[1])) - jag * r();
      d += ` L${(t * W).toFixed(1)} ${y.toFixed(1)}`;
    }
    return d + ` L${W} ${H}Z`;
  };
  let front, peak;
  const tr = h.track;
  if (tr && tr.ele && tr.ele.length > 5) {
    const n = 90, e = tr.ele, min = Math.min(...e), max = Math.max(...e), span = Math.max(max - min, 50);
    let d = `M0 ${H}`; peak = [0, H];
    for (let i = 0; i <= n; i++) {
      const v = e[Math.round(i / n * (e.length - 1))];
      const y = H * .94 - (v - min) / span * H * .58;
      const x = i / n * W; d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      if (y < peak[1]) peak = [x, y];
    }
    front = d + ` L${W} ${H}Z`;
  } else {
    const pk = .25 + r() * .5, n = 46; let d = `M0 ${H}`; peak = [0, H];
    const height = Math.min(1, (h.ascentM || 800) / 1400);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = H * .9 - H * .5 * height * Math.exp(-((t - pk) ** 2) / .03) - H * .1 * (.5 + .5 * Math.sin(t * 9 + r())) - 4 * r();
      const x = t * W; d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      if (y < peak[1]) peak = [x, y];
    }
    front = d + ` L${W} ${H}Z`;
  }
  const [px, py] = peak, sx = 60 + r() * 280, sy = 34 + r() * 30;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="${W}" height="${H}" fill="var(--sky)"/>
    <circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="18" fill="var(--sign)" opacity=".8"/>
    <path d="${layer(H * .5, 40, 4, 30)}" fill="var(--r1)"/>
    <path d="${layer(H * .66, 34, 5, 38)}" fill="var(--r2)"/>
    <path d="${front}" fill="var(--r3)"/>
    <g stroke="var(--r3)" stroke-width="2.4" stroke-linecap="round"><line x1="${px.toFixed(1)}" y1="${(py + 1).toFixed(1)}" x2="${px.toFixed(1)}" y2="${(py - 15).toFixed(1)}"/><line x1="${(px - 5).toFixed(1)}" y1="${(py - 10).toFixed(1)}" x2="${(px + 5).toFixed(1)}" y2="${(py - 10).toFixed(1)}"/></g>
  </svg>`;
}
function coverHtml(h) {
  if (h.photos && h.photos.length) return `<img src="${esc(foto(h.photos[0]))}" alt="" loading="lazy" data-fallback="${esc(h.id)}">`;
  return silhouette(h);
}
document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.dataset.fallback) { const h = byId(t.dataset.fallback); if (h) t.outerHTML = silhouette(h); }
}, true);

/* ---------- Filter & Sortierung ---------- */
function visible() {
  const f = state.filters, q = f.q.trim().toLowerCase();
  const list = state.hikes.filter(h => {
    if (q) { const hay = [h.name, h.summit, h.region, h.highlights, h.hut, h.notes, h.tips, h.companions].join(' ').toLowerCase(); if (!hay.includes(q)) return false; }
    if (f.oepnv && !h.oepnv) return false;
    if (f.diff.size && !f.diff.has(h.difficulty)) return false;
    if (f.region && h.region !== f.region) return false;
    return true;
  });
  const s = state.sort, big = 1e9;
  const cmp = {
    date: (a, b) => String(b.date || '').localeCompare(String(a.date || '')),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0),
    near: (a, b) => (fromMuc(a) ?? big) - (fromMuc(b) ?? big),
    ascent: (a, b) => (b.ascentM || 0) - (a.ascentM || 0),
    short: (a, b) => (a.durationH ?? big) - (b.durationH ?? big),
  }[s];
  return list.sort(cmp);
}

/* ---------- Ansichten ---------- */
function show(view) {
  state.view = view;
  $('#top').hidden = !(view === 'list' || view === 'map');
  $('#browse').hidden = !(view === 'list' || view === 'map');
  $('#grid').hidden = view !== 'list';
  $('#mapPane').hidden = view !== 'map';
  $('#detail').hidden = view !== 'detail';
  $('#form').hidden = view !== 'form';
  $('#tabList').setAttribute('aria-selected', view === 'list');
  $('#tabMap').setAttribute('aria-selected', view === 'map');
  $('#newBtn').hidden = !state.canEdit;
}

function renderAll() {
  renderTally(); renderRegionSelect(); renderStatus();
  if (state.view === 'list') renderGrid();
  if (state.view === 'map') renderMap();
  if (state.view === 'detail') { if (byId(state.openId)) renderDetail(); else back(); }
  show(state.view);
}

function renderTally() {
  const hs = state.hikes;
  const km = hs.reduce((s, h) => s + (h.distanceKm || 0), 0);
  const hm = hs.reduce((s, h) => s + (h.ascentM || 0), 0);
  const peaks = new Set(hs.map(h => h.summit).filter(Boolean)).size;
  const first = hs.map(h => h.date).filter(Boolean).sort()[0];
  const since = first ? ' seit ' + new Date(first + 'T12:00:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) : '';
  $('#bigHm').textContent = nf(hm);
  $('#tally').innerHTML = `<span><strong>Höhenmeter</strong>${esc(since)}</span><span>${nf(hs.length)} ${hs.length === 1 ? 'Tour' : 'Touren'}</span><span>${nf(km, 1)} km</span><span>${nf(peaks)} Gipfel</span>`;
}
function renderRegionSelect() {
  const sel = $('#fRegion'), cur = sel.value;
  const regions = [...new Set(state.hikes.map(h => h.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  sel.innerHTML = '<option value="">Alle Regionen</option>' + regions.map(r => `<option${r === cur ? ' selected' : ''}>${esc(r)}</option>`).join('');
  if (!regions.includes(cur)) { state.filters.region = ''; sel.value = ''; }
}
function renderStatus() {
  const el = $('#status'); let msg = '';
  if (state.unavailable) msg = 'Die Touren konnten gerade nicht geladen werden. Lade die Seite in ein paar Minuten neu.';
  else if (!state.loaded && state.slow) msg = 'Die Touren lassen sich gerade nicht laden. Prüfe die Verbindung, die Seite versucht es weiter.';
  else if (!state.loaded) msg = 'Touren werden geladen …';
  el.textContent = msg; el.hidden = !msg;
}

function factsHtml(h) {
  const parts = [];
  if (has(h.distanceKm)) parts.push(`<span>${nf(h.distanceKm, 1)} km</span>`);
  if (has(h.ascentM)) parts.push(`<span>${nf(h.ascentM)} Hm</span>`);
  if (h.difficulty && DIFF[h.difficulty]) parts.push(`<span><i class="dot ${h.difficulty}"></i>${DIFF[h.difficulty].label}</span>`);
  return parts.join('');
}
const shortDate = d => { if (!d) return ''; const x = new Date(d + 'T12:00:00'); return isNaN(x) ? d : x.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }); };
function pillsHtml(h) {
  return [
    has(h.distanceKm) && `${nf(h.distanceKm, 1)} km`,
    has(h.ascentM) && `↑ ${nf(h.ascentM)} m`,
    fmtDur(h.durationH),
    h.oepnv && 'Öffis',
  ].filter(Boolean).map(t => `<span>${esc(t)}</span>`).join('');
}
function cardHtml(h, lead) {
  const kicker = [lead, h.region, shortDate(h.date)].filter(Boolean).join(' · ');
  const diff = h.difficulty && DIFF[h.difficulty] ? `<span class="gchip"><i class="dot ${h.difficulty}"></i>${DIFF[h.difficulty].label}</span>` : '<span></span>';
  const rate = h.rating ? `<span class="gchip gold">★ ${nf(h.rating, 1)}</span>` : '';
  return `<article class="card" tabindex="0" role="link" data-open="${esc(h.id)}" aria-label="${esc(h.name)}">
    <div class="cover">${coverHtml(h)}</div>
    <div class="scrim"></div>
    <div class="card-top">${diff}${rate}</div>
    <div class="card-bottom">
      ${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}
      <h2 class="card-title">${esc(h.name)}</h2>
      <div class="pills">${pillsHtml(h)}</div>
    </div>
  </article>`;
}
function emptyHtml() {
  if (!state.loaded) return '';
  if (state.hikes.length) return `<div class="empty"><h2>Keine Treffer</h2><p>Keine Tour passt zu diesen Filtern. Nimm einen Filter heraus oder ändere die Suche.</p><button class="btn" data-act="reset">Filter zurücksetzen</button></div>`;
  return `<div class="empty"><h2>Noch keine Touren</h2><p>Hier erscheinen deine Wanderungen mit Strecke, Höhenmetern, Anreise ab München, Einkehr und Fotos.</p>${state.canEdit ? '<button class="btn sign-btn" data-act="new">Erste Tour eintragen</button>' : ''}</div>`;
}
function tileHtml(h) {
  const facts = [has(h.distanceKm) && nf(h.distanceKm, 1) + ' km', has(h.ascentM) && '↑ ' + nf(h.ascentM) + ' m'].filter(Boolean).join(' · ');
  return `<article class="tile" tabindex="0" role="link" data-open="${esc(h.id)}" aria-label="${esc(h.name)}">
    <div class="cover">${coverHtml(h)}</div>
    <div class="scrim"></div>
    ${h.difficulty ? `<span class="gchip tile-top" title="${esc(DIFF[h.difficulty].long)}"><i class="dot ${h.difficulty}"></i></span>` : ''}
    <div class="tile-bottom">
      <p class="tile-date">${esc([shortDate(h.date), h.region].filter(Boolean).join(' · '))}</p>
      <h3 class="tile-name">${esc(h.name)}</h3>
      ${facts ? `<p class="tile-facts">${esc(facts)}</p>` : ''}
    </div>
  </article>`;
}
const LEAD = { date: 'Zuletzt', rating: 'Am besten bewertet', near: 'Am nächsten', ascent: 'Die meisten Höhenmeter', short: 'Am kürzesten' };
function renderGrid() {
  const list = visible();
  if (!list.length) { $('#grid').innerHTML = emptyHtml(); return; }
  const [first, ...rest] = list;
  const f = state.filters, filtered = f.q.trim() || f.oepnv || f.diff.size || f.region;
  $('#grid').innerHTML = cardHtml(first, LEAD[state.sort])
    + (rest.length ? `<h2 class="grid-label">${filtered ? 'Weitere Treffer' : 'Alle Touren'}</h2>` + rest.map(tileHtml).join('') : '');
}

/* ---------- Karte ---------- */
const BB = { w: 10.0, e: 13.0, n: 48.35, s: 47.3 }, MW = 800, MH = 420;
const proj = (lat, lng) => [(lng - BB.w) / (BB.e - BB.w) * MW, (BB.n - lat) / (BB.n - BB.s) * MH];
const PX_KM = MW / ((BB.e - BB.w) * 111.32 * Math.cos(47.8 * Math.PI / 180));
const LAKES = [[48.0, 11.12, 2.4, 8, 6], [47.9, 11.31, 2.2, 9.5, 2], [47.695, 11.165, 2.2, 1.5, 0], [47.645, 11.35, 2, 1.6, 0], [47.59, 11.33, 3.2, 2.2, -10], [47.715, 11.755, 1.3, 3, 4], [47.725, 11.86, .8, 1.5, 0], [47.87, 12.43, 6, 4.5, 15], [47.6, 10.73, 1.7, 4, 25], [47.82, 12.98, 1.5, 4.5, 0]];
const TOWNS = [['Garmisch', 47.492, 11.095], ['Bad Tölz', 47.76, 11.557], ['Rosenheim', 47.857, 12.128], ['Füssen', 47.57, 10.70], ['Kochel', 47.66, 11.37], ['Tegernsee', 47.71, 11.758], ['Berchtesgaden', 47.63, 13.0], ['Kempten', 47.726, 10.315], ['Mittenwald', 47.44, 11.26], ['Prien', 47.856, 12.345]];
const ALPS = [[10.0, 47.6], [10.5, 47.62], [10.8, 47.6], [11.0, 47.63], [11.3, 47.67], [11.6, 47.71], [11.9, 47.73], [12.2, 47.75], [12.5, 47.77], [13.0, 47.79]];
function renderMap() {
  const hs = visible();
  const [mx, my] = proj(MUC.lat, MUC.lng);
  const alps = ALPS.map(([lng, lat]) => proj(lat, lng).map(v => v.toFixed(1)).join(' '));
  let s = `<defs><pattern id="peaks" width="22" height="16" patternUnits="userSpaceOnUse"><path d="M2 14 L8 5 L14 14" fill="none" stroke="var(--r2)" stroke-width="1.2"/></pattern></defs>
    <rect width="${MW}" height="${MH}" fill="var(--surface)"/>
    <path d="M${alps.join(' L')} L${MW} ${MH} L0 ${MH}Z" fill="url(#peaks)" opacity=".9"/>
    <path d="M${alps.join(' L')}" fill="none" stroke="var(--r2)" stroke-width="1.5" stroke-dasharray="3 4"/>`;
  [50, 100].forEach((km, i) => {
    const r = km * PX_KM, a = i ? Math.PI / 3 : Math.PI / 6;
    s += `<circle cx="${mx}" cy="${my}" r="${r.toFixed(1)}" fill="none" stroke="var(--line)" stroke-width="1.3" stroke-dasharray="6 5"/>
      <text x="${(mx + r * Math.sin(a)).toFixed(1)}" y="${(my + r * Math.cos(a)).toFixed(1)}" fill="var(--muted)" font-size="12" font-family="var(--f-body)" text-anchor="middle" dy="-4">${km} km</text>`;
  });
  LAKES.forEach(([lat, lng, rx, ry, rot]) => {
    const [x, y] = proj(lat, lng);
    s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(rx * PX_KM).toFixed(1)}" ry="${(ry * PX_KM).toFixed(1)}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" fill="var(--lake)" stroke="var(--lake-line)" stroke-width=".8"/>`;
  });
  TOWNS.forEach(([n, lat, lng]) => {
    const [x, y] = proj(lat, lng);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="var(--muted)"/><text x="${(x + 5).toFixed(1)}" y="${(y - 4).toFixed(1)}" fill="var(--muted)" font-size="12" font-family="var(--f-body)"${x > MW - 70 ? ' text-anchor="end"' : ''}>${n}</text>`;
  });
  s += `<rect x="${mx - 6}" y="${my - 6}" width="12" height="12" fill="var(--ink)"/><text x="${mx + 10}" y="${my + 5}" fill="var(--ink)" font-size="15" font-weight="700" font-family="var(--f-display)" letter-spacing="1">MÜNCHEN</text>`;
  hs.forEach(h => {
    if (!h.track || !h.track.lat) return;
    const pts = h.track.lat.map((lat, i) => proj(lat, h.track.lng[i]).map(v => v.toFixed(1)).join(',')).join(' ');
    s += `<polyline points="${pts}" fill="none" stroke="var(--d-${h.difficulty || 'rot'})" stroke-width="2.5" stroke-linejoin="round" opacity=".85"/>`;
  });
  hs.forEach(h => {
    if (!has(h.lat) || !has(h.lng)) return;
    const [x, y] = proj(h.lat, h.lng); if (x < 0 || x > MW || y < 0 || y > MH) return;
    const sel = state.mapSel === h.id;
    s += `<g class="map-pin" tabindex="0" role="button" aria-label="${esc(h.name)}" data-pin="${esc(h.id)}">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16" fill="transparent"/>
      <circle class="pin-core" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${sel ? 10 : 7.5}" fill="var(--d-${h.difficulty || 'rot'})" stroke="${sel ? 'var(--sign)' : 'var(--surface)'}" stroke-width="${sel ? 4 : 2.5}"/>
    </g>`;
  });
  $('#map').innerHTML = s;
  const noPos = hs.filter(h => !has(h.lat));
  const sel = byId(state.mapSel);
  $('#mapSel').innerHTML = sel ? miniHtml(sel) : '';
  const near = [...hs].sort((a, b) => (fromMuc(a) ?? 1e9) - (fromMuc(b) ?? 1e9));
  $('#mapList').innerHTML = near.length ? near.map(miniHtml).join('') : emptyHtml();
  if (noPos.length && hs.length) $('#mapList').insertAdjacentHTML('afterbegin', `<p class="card-meta" style="grid-column:1/-1;margin:0">${noPos.length === 1 ? 'Eine Tour hat' : noPos.length + ' Touren haben'} noch keinen Startpunkt und fehlen auf der Karte.</p>`);
}
function miniHtml(h) {
  const d = fromMuc(h);
  return `<div class="mini" tabindex="0" role="link" data-open="${esc(h.id)}">
    <div class="thumb">${coverHtml(h)}</div>
    <div><strong>${esc(h.name)}</strong>
      <div class="facts" style="font-size:14px">${factsHtml(h)}</div>
      <p class="card-meta">${[h.region, d != null ? nf(d) + ' km Luftlinie' : '', h.oepnv ? 'mit Öffis' : ''].filter(Boolean).map(esc).join(' · ')}</p>
    </div>
  </div>`;
}

/* ---------- Höhenprofil ---------- */
function profileSvg(tr) {
  const e = tr.ele, d = tr.d; if (!e || e.length < 3) return '';
  const W = 640, H = 200, L = 46, R = 12, T = 14, B = 28;
  let min = Math.min(...e), max = Math.max(...e);
  const ystep = max - min > 900 ? 200 : 100;
  min = Math.floor(min / ystep) * ystep; max = Math.ceil(max / ystep) * ystep; if (max === min) max += ystep;
  const total = d[d.length - 1] || 1;
  const xstep = total > 24 ? 5 : total > 10 ? 2 : 1;
  const X = v => L + v / total * (W - L - R), Y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const line = e.map((v, i) => `${X(d[i]).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  let g = '';
  for (let v = min; v <= max; v += ystep) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${nf(v)}</text>`;
  for (let v = 0; v <= total + .001; v += xstep) g += `<text x="${X(v).toFixed(1)}" y="${H - 8}" text-anchor="middle">${v} km</text>`;
  const iMax = e.indexOf(Math.max(...e));
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Höhenprofil von ${nf(Math.min(...e))} bis ${nf(Math.max(...e))} Meter">
    ${g}
    <polygon points="${X(0)},${Y(min)} ${line} ${X(total).toFixed(1)},${Y(min)}" fill="var(--forest)" opacity=".18"/>
    <polyline points="${line}" fill="none" stroke="var(--forest)" stroke-width="2.2" stroke-linejoin="round"/>
    <circle cx="${X(d[iMax]).toFixed(1)}" cy="${Y(e[iMax]).toFixed(1)}" r="4.5" fill="var(--sign)" stroke="var(--forest)" stroke-width="2"/>
    <text x="${X(d[iMax]).toFixed(1)}" y="${(Y(e[iMax]) - 9).toFixed(1)}" text-anchor="middle" style="fill:var(--ink);font-weight:600">${nf(e[iMax])} m</text>
  </svg>`;
}

/* ---------- Detail ---------- */
function openDetail(id, fromHistory) {
  if (!byId(id)) return;
  if (state.view === 'list' || state.view === 'map') { state.prevView = state.view; state.scrollY = window.scrollY; }
  state.openId = id; state.view = 'detail';
  renderDetail(); show('detail'); window.scrollTo(0, 0);
  document.title = `${byId(id).name} · Tourenbuch`;
  if (!fromHistory) try { history.pushState({ id }, '', `${BASE}/${id}`); } catch {}
}
function back(fromHistory) {
  document.title = 'Tourenbuch · Noel Gruber';
  if (!fromHistory) try { history.pushState({}, '', BASE); } catch {}
  state.openId = null; show(state.prevView);
  if (state.prevView === 'map') renderMap(); else renderGrid();
  requestAnimationFrame(() => window.scrollTo(0, state.scrollY));
}
function mapsLink(h, mode) {
  return `https://www.google.com/maps/dir/?api=1&origin=M%C3%BCnchen&destination=${h.lat},${h.lng}&travelmode=${mode}`;
}
function renderDetail() {
  const h = byId(state.openId); if (!h) return;
  const d = fromMuc(h);
  const unit = (v, u) => `${v} <small>${u}</small>`;
  const kf = [
    ['Strecke', has(h.distanceKm) ? unit(nf(h.distanceKm, 1), 'km') : '–'],
    ['Aufstieg', has(h.ascentM) ? unit(nf(h.ascentM), 'm') : '–'],
    ['Gehzeit', has(h.durationH) ? unit(esc(fmtDur(h.durationH).replace(' Std.', '')), 'Std.') : '–'],
    ['Schwierigkeit', h.difficulty ? `<i class="dot ${h.difficulty}"></i>${DIFF[h.difficulty].label}` : '–'],
    ['Gipfel', has(h.summitM) ? unit(nf(h.summitM), 'm') : (h.summit ? esc(h.summit) : '–')],
    ['Ab München', d != null ? unit(nf(d), 'km') : '–'],
  ];
  const kv = rows => rows.filter(([, v]) => has(v)).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  const travelCar = kv([['Fahrzeit', h.carTime], ['Parkplatz', h.parking]]);
  const travelPt = kv([['Verbindung', h.ptRoute], ['Dauer', h.ptTime]]);
  const way = kv([['Gipfel', h.summit], ['Einkehr', h.hut], ['Beste Zeit', h.season], ['Rundtour', h.loop ? 'Ja' : (h.loop === false ? 'Nein, Streckentour' : '')]]);
  const photos = h.photos || [];
  const sub = [h.loop ? '<span class="tag">Rundtour</span>' : '', h.oepnv ? '<span class="tag">Mit Öffis erreichbar</span>' : '', stars(h.rating)].join('');
  $('#detail').innerHTML = `
    <div class="d-hero">
      <div class="cover">${coverHtml(h)}</div>
      <div class="scrim"></div>
      <button class="d-hero-btn d-back glass" data-act="back" aria-label="Zurück zur Übersicht">←</button>
      ${photos.length ? `<button class="gchip d-count" data-photo="0">${photos.length === 1 ? '1 Foto' : photos.length + ' Fotos'} ansehen</button>` : ''}
    </div>
    <div class="wrap d-body">
      <div class="d-head">
        <p class="kicker">${esc([h.region, fmtDate(h.date)].filter(Boolean).join(' · '))}</p>
        <h2>${esc(h.name)}</h2>
        ${sub.trim() ? `<div class="d-sub">${sub}</div>` : ''}
      </div>
      <dl class="keyfacts">${kf.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <div class="cols">
        <div class="block"><h3>Anreise mit dem Auto</h3>${travelCar ? `<dl class="kv">${travelCar}</dl>` : '<p class="card-meta">Noch nichts eingetragen.</p>'}</div>
        <div class="block"><h3>Anreise mit Öffis</h3>${travelPt ? `<dl class="kv">${travelPt}</dl>` : '<p class="card-meta">Noch nichts eingetragen.</p>'}</div>
      </div>
      ${h.track && h.track.ele ? `<div class="block profile"><h3>Höhenprofil</h3>${profileSvg(h.track)}</div>` : ''}
      <div class="cols">
        ${h.highlights || way ? `<div class="block"><h3>Unterwegs</h3>${h.highlights ? `<p>${esc(h.highlights)}</p>` : ''}${way ? `<dl class="kv">${way}</dl>` : ''}</div>` : ''}
        ${h.notes || h.companions ? `<div class="block"><h3>Wie war's?</h3>${h.notes ? `<p>${esc(h.notes)}</p>` : ''}${h.companions ? `<p class="card-meta">Dabei: ${esc(h.companions)}</p>` : ''}</div>` : ''}
        ${h.tips ? `<div class="block"><h3>Tipps fürs nächste Mal</h3><p>${esc(h.tips)}</p></div>` : ''}
      </div>
      ${photos.length ? `<div class="block"><h3>Fotos</h3><div class="gallery">${photos.map((p, i) => `<button data-photo="${i}" aria-label="Foto ${i + 1} öffnen"><img src="${esc(foto(p))}" alt="" loading="lazy"></button>`).join('')}</div></div>` : ''}
      ${h.link ? `<div class="links"><a class="btn" href="${esc(h.link)}" target="_blank" rel="noopener">Tour bei ${esc(hostOf(h.link))} öffnen</a></div>` : ''}
      <div class="actions"><button class="btn" data-act="copy">Infos als Text kopieren</button>${state.canEdit ? '<button class="btn" data-act="edit">Bearbeiten</button><button class="btn danger" data-act="ask-delete">Löschen</button>' : ''}</div>
      <div id="confirmDel" class="confirm" hidden><span>Diese Tour und ihre Fotos endgültig löschen?</span><button class="btn danger" data-act="delete">Ja, löschen</button><button class="btn ghost" data-act="cancel-delete">Abbrechen</button></div>
      <textarea id="copyBox" class="copybox" readonly hidden aria-label="Tourtext zum Kopieren"></textarea>
      <div class="dock">
        <button class="btn primary" data-act="share">Tour teilen</button>
        ${has(h.lat) ? `<a class="btn" href="${mapsLink(h, 'driving')}" target="_blank" rel="noopener">Auto</a><a class="btn" href="${mapsLink(h, 'transit')}" target="_blank" rel="noopener">Öffis</a>` : ''}
      </div>
    </div>`;
}
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'Link'; } };
function summaryText(h) {
  const L = [h.name + (h.summit ? ` (${h.summit}${has(h.summitM) ? ', ' + nf(h.summitM) + ' m' : ''})` : '')];
  L.push([has(h.distanceKm) && nf(h.distanceKm, 1) + ' km', has(h.ascentM) && nf(h.ascentM) + ' Hm', fmtDur(h.durationH), h.difficulty && DIFF[h.difficulty].long].filter(Boolean).join(' · '));
  if (h.region) L.push('Region: ' + h.region);
  if (h.carTime || h.parking) L.push('Auto: ' + [h.carTime, h.parking].filter(Boolean).join(', '));
  if (h.ptRoute || h.ptTime) L.push('Öffis: ' + [h.ptRoute, h.ptTime].filter(Boolean).join(', '));
  if (h.hut) L.push('Einkehr: ' + h.hut);
  if (h.season) L.push('Beste Zeit: ' + h.season);
  if (h.tips) L.push('Tipps: ' + h.tips);
  if (has(h.lat)) L.push('Start: https://www.google.com/maps?q=' + h.lat + ',' + h.lng);
  if (h.link) L.push(h.link);
  L.push(`${location.origin}${BASE}/${h.id}`);
  return L.join('\n');
}

/* ---------- Lightbox ---------- */
function openLb(photos, i) { state.lb = { photos, i }; updLb(); $('#lightbox').hidden = false; $('#lbClose').focus(); }
function updLb() { const { photos, i } = state.lb; $('#lbImg').src = foto(photos[i]); $('#lbCount').textContent = `${i + 1} / ${photos.length}`; $('#lbPrev').hidden = $('#lbNext').hidden = photos.length < 2; }
function stepLb(n) { const l = state.lb; l.i = (l.i + n + l.photos.length) % l.photos.length; updLb(); }
function closeLb() { $('#lightbox').hidden = true; }

/* ---------- GPX ---------- */
function parseGpx(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  let pts = [...xml.getElementsByTagName('trkpt')]; if (!pts.length) pts = [...xml.getElementsByTagName('rtept')];
  const raw = pts.map(p => ({ lat: +p.getAttribute('lat'), lng: +p.getAttribute('lon'), ele: parseFloat(p.getElementsByTagName('ele')[0]?.textContent) })).filter(p => isFinite(p.lat) && isFinite(p.lng));
  if (raw.length < 2) throw new Error('In der Datei sind keine Trackpunkte.');
  let dist = 0, asc = 0, anchor = null, lastEle = null; const all = [];
  raw.forEach((p, i) => {
    if (i) dist += hav(raw[i - 1], p);
    let e = isFinite(p.ele) ? p.ele : lastEle; if (e != null) lastEle = e;
    if (e != null) { if (anchor == null) anchor = e; else if (e - anchor > 4) { asc += e - anchor; anchor = e; } else if (anchor - e > 4) anchor = e; }
    all.push([p.lat, p.lng, e, dist]);
  });
  const step = Math.max(1, Math.ceil(all.length / 400));
  const ds = all.filter((_, i) => i % step === 0 || i === all.length - 1);
  const hasEle = ds.some(p => p[2] != null);
  const track = { lat: ds.map(p => +p[0].toFixed(5)), lng: ds.map(p => +p[1].toFixed(5)), d: ds.map(p => +p[3].toFixed(2)) };
  if (hasEle) { let prev = ds.find(p => p[2] != null)[2]; track.ele = ds.map(p => { if (p[2] != null) prev = p[2]; return Math.round(prev); }); }
  return {
    track, distanceKm: +dist.toFixed(1), ascentM: hasEle ? Math.round(asc) : null,
    lat: +raw[0].lat.toFixed(5), lng: +raw[0].lng.toFixed(5),
    maxEle: hasEle ? Math.max(...track.ele) : null, loop: hav(raw[0], raw[raw.length - 1]) < .4,
  };
}

/* ---------- Formular ---------- */
function openForm(id) {
  const h = id ? byId(id) : null;
  if (state.view === 'list' || state.view === 'map') { state.prevView = state.view; state.scrollY = window.scrollY; }
  state.form = { id: h ? h.id : null, photos: (h?.photos || []).map(a => ({ id: a })), removed: [], track: h?.track || null, busy: false };
  const v = k => esc(h?.[k] ?? '');
  const rating = h?.rating || 0;
  const today = new Date().toISOString().slice(0, 10);
  $('#form').innerHTML = `
    <button class="btn ghost back" data-act="form-cancel">← Abbrechen</button>
    <h2>${h ? 'Tour bearbeiten' : 'Neue Tour'}</h2>
    <p class="lead">Nur der Name ist Pflicht. Den Rest kannst du jederzeit ergänzen.</p>
    <form id="hikeForm" novalidate>
      <fieldset><legend>Eckdaten</legend><div class="fgrid">
        <div class="field wide"><label for="f_name">Name der Tour</label><input type="text" id="f_name" required value="${v('name')}" placeholder="z. B. Herzogstand – Heimgarten"></div>
        <div class="field"><label for="f_date">Datum</label><input type="date" id="f_date" value="${h ? v('date') : today}"></div>
        <div class="field"><label for="f_region">Region</label><input type="text" id="f_region" list="regionList" value="${v('region')}" placeholder="z. B. Tegernseer Berge"><datalist id="regionList">${REGIONS.map(r => `<option value="${esc(r)}">`).join('')}</datalist></div>
        <div class="field"><label for="f_summit">Gipfel / Ziel</label><input type="text" id="f_summit" value="${v('summit')}"></div>
        <div class="field"><label for="f_summitM">Gipfelhöhe (m)</label><input type="number" inputmode="numeric" id="f_summitM" value="${v('summitM')}"></div>
        <div class="field"><label for="f_dist">Strecke (km)</label><input type="text" inputmode="decimal" id="f_dist" value="${has(h?.distanceKm) ? nf(h.distanceKm, 1) : ''}"></div>
        <div class="field"><label for="f_asc">Höhenmeter</label><input type="number" inputmode="numeric" id="f_asc" value="${v('ascentM')}"></div>
        <div class="field"><label for="f_dur">Gehzeit (Std:Min)</label><input type="text" inputmode="decimal" id="f_dur" value="${durInput(h?.durationH)}" placeholder="z. B. 5:30"></div>
        <div class="field wide"><span class="lbl" id="diffLbl">Schwierigkeit</span><div class="radios" role="radiogroup" aria-labelledby="diffLbl">
          ${Object.entries(DIFF).map(([k, o]) => `<label><input type="radio" name="f_diff" id="f_diff_${k}" value="${k}"${h?.difficulty === k ? ' checked' : ''}><i class="dot ${k}"></i>${o.long}</label>`).join('')}
        </div></div>
        <div class="field"><label class="check"><input type="checkbox" id="f_loop"${h?.loop ? ' checked' : ''}> Rundtour</label></div>
      </div></fieldset>

      <fieldset><legend>Anreise ab München</legend><div class="fgrid">
        <div class="field"><label for="f_carTime">Fahrzeit mit dem Auto</label><input type="text" id="f_carTime" value="${v('carTime')}" placeholder="z. B. 1:10 Std."></div>
        <div class="field"><label for="f_parking">Parkplatz</label><input type="text" id="f_parking" value="${v('parking')}" placeholder="Name, Kosten, ab wann voll"></div>
        <div class="field"><label for="f_ptRoute">Öffis: Verbindung</label><input type="text" id="f_ptRoute" value="${v('ptRoute')}" placeholder="z. B. BOB bis Schliersee, dann Bus 9562"></div>
        <div class="field"><label for="f_ptTime">Öffis: Dauer</label><input type="text" id="f_ptTime" value="${v('ptTime')}" placeholder="z. B. 1:30 Std."></div>
        <div class="field"><label class="check"><input type="checkbox" id="f_oepnv"${h?.oepnv ? ' checked' : ''}> Gut mit Öffis erreichbar</label></div>
        <div class="field"><label for="f_coords">Startpunkt (Breite, Länge)</label><input type="text" id="f_coords" value="${has(h?.lat) ? h.lat + ', ' + h.lng : ''}" placeholder="z. B. 47.5935, 11.3365"><small>In Google Maps lange auf den Punkt drücken und die Zahlen kopieren. Kommt auch aus der GPX-Datei.</small></div>
      </div></fieldset>

      <fieldset><legend>Unterwegs</legend><div class="fgrid">
        <div class="field wide"><label for="f_highlights">Highlights</label><textarea id="f_highlights" placeholder="Aussicht, Grat, See zum Baden …">${v('highlights')}</textarea></div>
        <div class="field"><label for="f_hut">Einkehr</label><input type="text" id="f_hut" value="${v('hut')}" placeholder="Hütte, Ruhetag, Empfehlung"></div>
        <div class="field"><label for="f_season">Beste Zeit</label><input type="text" id="f_season" value="${v('season')}" placeholder="z. B. Juni bis Oktober"></div>
        <div class="field wide"><label for="f_link">Link zur Tour (Komoot, Outdooractive …)</label><input type="url" id="f_link" value="${v('link')}" placeholder="https://"></div>
      </div></fieldset>

      <fieldset><legend>Persönlich</legend><div class="fgrid">
        <div class="field wide"><span class="lbl" id="rateLbl">Bewertung</span><div class="starpick" role="radiogroup" aria-labelledby="rateLbl">
          ${[1, 2, 3, 4, 5].map(n => `<label class="${n <= rating ? 'on' : ''}" title="${n} von 5"><input type="radio" name="f_rating" id="f_rating_${n}" value="${n}"${n === rating ? ' checked' : ''} aria-label="${n} von 5 Sternen">★</label>`).join('')}
        </div></div>
        <div class="field wide"><label for="f_notes">Wie war's?</label><textarea id="f_notes">${v('notes')}</textarea></div>
        <div class="field wide"><label for="f_tips">Tipps fürs nächste Mal</label><textarea id="f_tips" placeholder="Früher los, Stirnlampe, Bargeld für die Hütte …">${v('tips')}</textarea></div>
        <div class="field wide"><label for="f_companions">Dabei</label><input type="text" id="f_companions" value="${v('companions')}"></div>
      </div></fieldset>

      <fieldset><legend>Fotos & GPS-Track</legend>
        ${state.canEdit ? `<label class="btn filebtn" for="f_photos">Fotos hinzufügen<input type="file" id="f_photos" accept="image/*" multiple></label>
        <p class="note">Fotos werden vor dem Hochladen verkleinert. Das erste Foto ist das Titelbild.</p>
        <div class="photos-edit" id="photoList"></div>` : '<p class="note">Fotos hochladen ist in dieser Ansicht nicht möglich.</p>'}
        <div style="margin-top:18px"><label class="btn filebtn" for="f_gpx">GPX-Datei wählen<input type="file" id="f_gpx" accept=".gpx,application/gpx+xml,application/xml,text/xml"></label>
        ${state.form.track ? ' <button type="button" class="btn ghost" data-act="gpx-remove">Track entfernen</button>' : ''}
        <p class="note${state.form.track ? ' ok' : ''}" id="gpxNote">${state.form.track ? 'Track ist gespeichert. Eine neue Datei ersetzt ihn.' : 'Aus Komoot, Strava oder der Uhr exportieren. Strecke, Höhenmeter und Startpunkt werden dann ausgefüllt.'}</p></div>
      </fieldset>

      <div class="form-actions">
        <button type="submit" class="btn primary" id="saveBtn">Tour speichern</button>
        <button type="button" class="btn ghost" data-act="form-cancel">Abbrechen</button>
        <span class="msg" id="formMsg" role="status"></span>
      </div>
    </form>`;
  renderPhotoList();
  show('form'); state.view = 'form'; window.scrollTo(0, 0);
  if (!h) $('#f_name').focus();
}
function renderPhotoList() {
  const el = $('#photoList'); if (!el) return;
  el.innerHTML = state.form.photos.map((p, i) => `<div class="ph"><img src="${p.id ? esc(foto(p.id)) : p.url}" alt="">
    ${i === 0 ? '<span class="cover-tag">Titelbild</span>' : ''}
    <div class="ph-tools">${i ? `<button type="button" data-ph-cover="${i}">Titelbild</button>` : '<span></span>'}<button type="button" data-ph-del="${i}" aria-label="Foto entfernen">✕</button></div></div>`).join('');
}
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const s = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encode')), 'image/jpeg', .85));
  } catch { return file; }
}
async function saveForm(e) {
  e.preventDefault();
  const F = state.form; if (F.busy) return;
  const msg = $('#formMsg'); msg.className = 'msg'; msg.textContent = '';
  const name = $('#f_name').value.trim();
  if (!name) { msg.className = 'msg err'; msg.textContent = 'Gib der Tour einen Namen.'; $('#f_name').focus(); return; }
  let lat = null, lng = null; const c = $('#f_coords').value.trim();
  if (c) {
    const m = c.match(/(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/);
    if (!m) { msg.className = 'msg err'; msg.textContent = 'Startpunkt bitte als „47.59, 11.33“ eingeben.'; $('#f_coords').focus(); return; }
    lat = +parseFloat(m[1].replace(',', '.')).toFixed(5); lng = +parseFloat(m[2].replace(',', '.')).toFixed(5);
  }
  F.busy = true; $('#saveBtn').disabled = true;
  try {
    const id = F.id || uniqueSlug(name);
    const ids = [];
    const news = F.photos.filter(p => !p.id).length; let k = 0;
    for (const p of F.photos) {
      if (p.id) { ids.push(p.id); continue; }
      k++; msg.textContent = `Foto ${k} von ${news} wird hochgeladen …`;
      const blob = await shrink(p.file);
      const path = `${id}/${Date.now()}-${k}.jpg`;
      const up = await state.sb.storage.from('fotos').upload(path, blob, { contentType: blob.type || 'image/jpeg', cacheControl: '31536000' });
      if (up.error) throw new Error('Ein Foto konnte nicht hochgeladen werden. Nur JPG, PNG oder WebP bis 10 MB. Speichere erneut.');
      p.id = path; delete p.file; ids.push(path);
    }
    msg.textContent = 'Wird gespeichert …';
    const old = F.id ? byId(F.id) : null;
    const rating = +($('input[name=f_rating]:checked')?.value || 0) || null;
    const doc = {
      name, date: $('#f_date').value || null, region: $('#f_region').value.trim() || null,
      summit: $('#f_summit').value.trim() || null, summitM: num($('#f_summitM').value),
      distanceKm: num($('#f_dist').value), ascentM: num($('#f_asc').value), durationH: parseDur($('#f_dur').value),
      difficulty: $('input[name=f_diff]:checked')?.value || null, loop: $('#f_loop').checked,
      carTime: $('#f_carTime').value.trim() || null, parking: $('#f_parking').value.trim() || null,
      ptRoute: $('#f_ptRoute').value.trim() || null, ptTime: $('#f_ptTime').value.trim() || null, oepnv: $('#f_oepnv').checked,
      lat, lng,
      highlights: $('#f_highlights').value.trim() || null, hut: $('#f_hut').value.trim() || null,
      season: $('#f_season').value.trim() || null, link: $('#f_link').value.trim() || null,
      rating, notes: $('#f_notes').value.trim() || null, tips: $('#f_tips').value.trim() || null,
      companions: $('#f_companions').value.trim() || null,
      photos: ids, track: F.track || null,
      createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    const saved = await state.sb.from('tours').upsert({ id, data: doc, updated_at: doc.updatedAt });
    if (saved.error) throw saved.error;
    if (F.removed.length) state.sb.storage.from('fotos').remove(F.removed).catch(() => {});
    await loadTours().catch(() => {});
    F.busy = false;
    toast('Tour gespeichert');
    state.form = null;
    if (!byId(id)) state.hikes.push({ id, ...doc });
    state.view = state.prevView;
    openDetail(id, location.pathname === `${BASE}/${id}`);
  } catch (err) {
    F.busy = false; $('#saveBtn').disabled = false;
    msg.className = 'msg err';
    msg.textContent = err && err.code ? 'Speichern hat nicht geklappt. Bist du noch angemeldet? Melde dich unten auf der Seite neu an und versuche es noch einmal.' : (err.message || 'Speichern hat nicht geklappt.');
  }
}
async function deleteHike(id) {
  const h = byId(id); if (!h) return;
  try {
    const del = await state.sb.from('tours').delete().eq('id', id);
    if (del.error) throw del.error;
    if ((h.photos || []).length) state.sb.storage.from('fotos').remove(h.photos).catch(() => {});
    state.hikes = state.hikes.filter(x => x.id !== id);
    toast('Tour gelöscht'); back();
  } catch { toast('Löschen hat nicht geklappt'); }
}

/* ---------- Ereignisse ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-open],[data-pin],[data-act],[data-photo],[data-ph-del],[data-ph-cover],[data-diff]');
  if (!t) return;
  if (t.dataset.open) return openDetail(t.dataset.open);
  if (t.dataset.pin) { state.mapSel = t.dataset.pin; renderMap(); $('#mapSel').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  if (t.dataset.diff) { const f = state.filters.diff, k = t.dataset.diff; f.has(k) ? f.delete(k) : f.add(k); t.setAttribute('aria-pressed', f.has(k)); return refreshBrowse(); }
  if (t.dataset.photo) return openLb(byId(state.openId).photos, +t.dataset.photo);
  if (t.dataset.phDel) { const [p] = state.form.photos.splice(+t.dataset.phDel, 1); if (p.id) state.form.removed.push(p.id); else URL.revokeObjectURL(p.url); return renderPhotoList(); }
  if (t.dataset.phCover) { const [p] = state.form.photos.splice(+t.dataset.phCover, 1); state.form.photos.unshift(p); return renderPhotoList(); }
  const a = t.dataset.act;
  if (a === 'back') back();
  else if (a === 'new') openForm(null);
  else if (a === 'edit') openForm(state.openId);
  else if (a === 'form-cancel') { const id = state.form?.id; state.form = null; if (id && byId(id)) { state.openId = id; state.view = 'detail'; renderDetail(); show('detail'); } else back(); window.scrollTo(0, 0); }
  else if (a === 'ask-delete') $('#confirmDel').hidden = false;
  else if (a === 'cancel-delete') $('#confirmDel').hidden = true;
  else if (a === 'delete') deleteHike(state.openId);
  else if (a === 'reset') { state.filters = { q: '', oepnv: false, diff: new Set(), region: '' }; $('#q').value = ''; $('#fRegion').value = ''; $$('.chip').forEach(c => c.setAttribute('aria-pressed', 'false')); refreshBrowse(); }
  else if (a === 'gpx-remove') { state.form.track = null; t.remove(); const n = $('#gpxNote'); n.className = 'note'; n.textContent = 'Track wird beim Speichern entfernt.'; }
  else if (a === 'share') {
    const h = byId(state.openId), url = `${location.origin}${BASE}/${h.id}`;
    if (navigator.share) { try { await navigator.share({ title: h.name, text: `${h.name} – aus meinem Tourenbuch`, url }); } catch {} return; }
    try { await navigator.clipboard.writeText(url); toast('Link kopiert'); }
    catch { const box = $('#copyBox'); box.value = url; box.hidden = false; box.focus(); box.select(); toast('Link markiert, jetzt kopieren'); }
  }
  else if (a === 'copy') {
    const txt = summaryText(byId(state.openId));
    try { await navigator.clipboard.writeText(txt); toast('Kopiert, jetzt in WhatsApp einfügen'); }
    catch { const box = $('#copyBox'); box.value = txt; box.hidden = false; box.focus(); box.select(); toast('Text markiert, jetzt kopieren'); }
  }
});
document.addEventListener('keydown', e => {
  if (!$('#lightbox').hidden) { if (e.key === 'Escape') closeLb(); if (e.key === 'ArrowLeft') stepLb(-1); if (e.key === 'ArrowRight') stepLb(1); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-open],[data-pin]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.name === 'f_rating') $$('.starpick label').forEach((l, i) => l.classList.toggle('on', i < +t.value));
  if (t.id === 'f_photos') {
    for (const f of t.files) state.form.photos.push({ file: f, url: URL.createObjectURL(f) });
    t.value = ''; renderPhotoList();
  }
  if (t.id === 'f_gpx' && t.files[0]) {
    const note = $('#gpxNote');
    try {
      const g = parseGpx(await t.files[0].text());
      state.form.track = g.track;
      $('#f_dist').value = nf(g.distanceKm, 1);
      if (g.ascentM != null) $('#f_asc').value = g.ascentM;
      $('#f_coords').value = g.lat + ', ' + g.lng;
      $('#f_loop').checked = g.loop;
      if (g.maxEle != null && !$('#f_summitM').value) $('#f_summitM').value = g.maxEle;
      note.className = 'note ok';
      note.textContent = `Track übernommen: ${nf(g.distanceKm, 1)} km${g.ascentM != null ? ', ' + nf(g.ascentM) + ' Hm' : ''}, Startpunkt gesetzt.`;
    } catch (err) { note.className = 'note err'; note.textContent = 'Die Datei ließ sich nicht lesen. ' + (err.message || ''); }
    t.value = '';
  }
});
document.addEventListener('submit', e => { if (e.target.id === 'hikeForm') saveForm(e); });
$('#lbClose').onclick = closeLb; $('#lbPrev').onclick = () => stepLb(-1); $('#lbNext').onclick = () => stepLb(1);
$('#lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLb(); });
$('#tabList').onclick = () => { show('list'); renderGrid(); };
$('#tabMap').onclick = () => { show('map'); renderMap(); };
$('#newBtn').onclick = () => openForm(null);
$('#filterToggle').onclick = e => { const p = $('#filterPanel'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', !p.hidden); if (!p.hidden) $('#q').focus(); };
function updFilterCount() {
  const f = state.filters, n = (f.q.trim() ? 1 : 0) + (f.oepnv ? 1 : 0) + f.diff.size + (f.region ? 1 : 0);
  const b = $('#filterToggle'); b.textContent = n ? `Filter aktiv · ${n}` : 'Suchen & Filtern'; b.setAttribute('aria-pressed', n > 0);
}
$('#q').addEventListener('input', e => { state.filters.q = e.target.value; refreshBrowse(); });
$('#fOepnv').onclick = e => { state.filters.oepnv = !state.filters.oepnv; e.currentTarget.setAttribute('aria-pressed', state.filters.oepnv); refreshBrowse(); };
$('#fRegion').onchange = e => { state.filters.region = e.target.value; refreshBrowse(); };
$('#sort').onchange = e => { state.sort = e.target.value; refreshBrowse(); };
function refreshBrowse() { updFilterCount(); if (state.view === 'map') renderMap(); else renderGrid(); }

/* ---------- Start ---------- */
async function loadTours() {
  const { data, error } = await state.sb.from('tours').select('id,data');
  if (error) throw error;
  state.hikes = data.map(r => ({ ...r.data, id: r.id }));
  state.loaded = true;
}
function routeFromPath() {
  const m = location.pathname.match(/^\/touren\/([a-z0-9-]+)\/?$/);
  if (m && byId(m[1])) openDetail(m[1], true);
  else if (state.view === 'detail' || state.view === 'form') { state.form = null; back(true); }
  else if (m) { try { history.replaceState({}, '', BASE); } catch {} toast('Diese Tour gibt es nicht mehr.'); }
}

/* ---------- Anmelden (nur zum Eintragen) ---------- */
function setUser(u) {
  state.user = u;
  state.canEdit = !!u && String(u.email || '').toLowerCase() === OWNER;
  $('#loginBtn').textContent = u ? 'Abmelden' : 'Anmelden';
  if (u) $('#loginForm').hidden = true;
  show(state.view);
  if (state.view === 'detail') renderDetail(); else if (state.view === 'list') renderGrid();
}
$('#loginBtn').onclick = async () => {
  if (state.user) { await state.sb.auth.signOut(); toast('Abgemeldet'); return; }
  const f = $('#loginForm'); f.hidden = !f.hidden; if (!f.hidden) $('#loginMail').focus();
};
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const mail = $('#loginMail').value.trim().toLowerCase(), note = $('#loginNote');
  if (!mail || !state.sb) return;
  note.textContent = 'Wird gesendet …';
  const { error } = await state.sb.auth.signInWithOtp({ email: mail, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: mail === OWNER } });
  note.textContent = error ? 'Das hat nicht geklappt. Prüfe die Adresse oder versuche es in ein paar Minuten noch einmal.' : 'Der Login-Link ist unterwegs. Öffne ihn auf diesem Gerät.';
});

async function init() {
  renderAll();
  if (!window.supabase) { state.unavailable = true; renderAll(); return; }
  state.sb = window.supabase.createClient(SB_URL, SB_KEY);
  state.sb.auth.getSession().then(({ data }) => setUser(data.session?.user || null)).catch(() => {});
  state.sb.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
  try { await loadTours(); } catch { state.unavailable = true; }
  renderAll();
  routeFromPath();
  window.addEventListener('popstate', routeFromPath);
}
init();
})();
