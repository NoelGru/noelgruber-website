(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var systemHell = window.matchMedia('(prefers-color-scheme: light)');
  var wurzel = document.documentElement;
  var punkt = '185,200,255';

  /* ── Hell/Dunkel ─────────────────────────── */
  function farbenNeuLesen() {
    var wert = getComputedStyle(wurzel).getPropertyValue('--punkt').trim();
    if (wert) punkt = wert;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var bg = getComputedStyle(wurzel).getPropertyValue('--bg').trim();
      if (bg) meta.setAttribute('content', bg);
    }
  }

  function istHell() {
    var gewaehlt = wurzel.getAttribute('data-theme');
    if (gewaehlt) return gewaehlt === 'light';
    return systemHell.matches;
  }

  function knoepfeBeschriften() {
    var hell = istHell();
    Array.prototype.forEach.call(document.querySelectorAll('.thema'), function (b) {
      b.setAttribute('aria-pressed', hell ? 'true' : 'false');
      var text = hell ? 'Zur dunklen Ansicht wechseln' : 'Zur hellen Ansicht wechseln';
      b.setAttribute('aria-label', text);
      b.setAttribute('title', text);
    });
  }

  function themaSetzen(wert) {
    wurzel.setAttribute('data-theme', wert);
    try { localStorage.setItem('theme', wert); } catch (e) {}
    farbenNeuLesen();
    knoepfeBeschriften();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.thema'), function (b) {
    b.addEventListener('click', function () { themaSetzen(istHell() ? 'dark' : 'light'); });
  });

  // Ohne eigene Wahl folgt die Seite weiter der Systemeinstellung
  var aufSystem = function () {
    if (!wurzel.getAttribute('data-theme')) { farbenNeuLesen(); knoepfeBeschriften(); }
  };
  if (systemHell.addEventListener) systemHell.addEventListener('change', aufSystem);
  else if (systemHell.addListener) systemHell.addListener(aufSystem);

  farbenNeuLesen();
  knoepfeBeschriften();

  /* ── Laufband ────────────────────────────── */
  var track = document.getElementById('track');
  if (track) {
    var items = ['Websites', 'Web-Apps', 'SaaS', 'Automatisierungen', 'SEO', 'Google Ads', 'Supabase', 'Vercel', 'Reporting'];
    var one = items.map(function (t) { return '<span>' + t + '<i>/</i></span>'; }).join('');
    track.innerHTML = one + one;
  }

  /* ── Punkteraster mit Cursorlicht ────────── */
  var c = document.getElementById('grid');
  if (c && c.getContext) {
    var ctx = c.getContext('2d');
    var mx = -999, my = -999, w = 0, h = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var t0 = performance.now();

    function size() {
      var r = c.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now) {
      var tt = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      var step = 30;
      for (var x = step / 2; x < w; x += step) {
        for (var y = step / 2; y < h; y += step) {
          var dx = x - mx, dy = y - my;
          var near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 240);
          var wave = reduce ? 0 : (Math.sin(x * 0.012 + y * 0.016 + tt * 0.7) + 1) / 2;
          var a = 0.055 + near * 0.5 + wave * 0.045;
          ctx.beginPath();
          ctx.arc(x, y, 1 + near * 1.7, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(' + punkt + ',' + a.toFixed(3) + ')';
          ctx.fill();
        }
      }
      if (!reduce) requestAnimationFrame(draw);
    }

    size();
    requestAnimationFrame(draw);
    window.addEventListener('resize', function () { size(); if (reduce) requestAnimationFrame(draw); });

    var hero = document.querySelector('.hero');
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
      hero.style.setProperty('--mx', mx + 'px');
      hero.style.setProperty('--my', my + 'px');
    });
    hero.addEventListener('pointerleave', function () { mx = -999; my = -999; });

    // Nach einem Themenwechsel das Raster sofort neu zeichnen
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.thema') && reduce) requestAnimationFrame(draw);
    });
  }

  /* ── Anfrageformular ─────────────────────── */
  var form = document.getElementById('form');
  if (form) {
    var note = document.getElementById('fnote');
    var send = document.getElementById('send');
    var standard = note.innerHTML;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      note.className = 'fnote';

      var data = {
        name: form.name.value.trim(),
        mail: form.mail.value.trim(),
        art: form.art.value,
        text: form.text.value.trim(),
        firma: form.firma.value
      };

      if (!data.name || !data.mail || !data.text) {
        note.className = 'fnote err';
        note.textContent = 'Bitte Name, E-Mail und eine kurze Beschreibung ausfüllen.';
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.mail)) {
        note.className = 'fnote err';
        note.textContent = 'Die E-Mail-Adresse sieht nicht vollständig aus.';
        return;
      }

      send.disabled = true;
      send.textContent = 'Wird gesendet …';

      fetch('/api/anfrage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.body && res.body.fehler ? res.body.fehler : 'Senden fehlgeschlagen');
          form.reset();
          note.className = 'fnote ok';
          note.textContent = 'Danke, ist angekommen. Ich melde mich meist am selben Tag.';
          send.textContent = 'Gesendet';
        })
        .catch(function () {
          note.className = 'fnote err';
          note.innerHTML = 'Das hat gerade nicht geklappt. Schreib mir gern direkt an ' +
            '<a href="mailto:noel.gruber98@gmail.com">noel.gruber98@gmail.com</a>.';
          send.disabled = false;
          send.textContent = 'Nochmal senden';
        });
    });

    form.addEventListener('input', function () {
      if (note.className !== 'fnote') { note.className = 'fnote'; note.innerHTML = standard; }
    });
  }
})();
