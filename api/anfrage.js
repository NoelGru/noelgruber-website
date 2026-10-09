/* Nimmt das Anfrageformular entgegen und schickt es per E-Mail weiter.
   Läuft als Vercel Function. Benötigte Umgebungsvariablen:
     RESEND_API_KEY   — Schlüssel aus dem Resend-Konto (Pflicht)
     ANFRAGE_AN       — Empfängeradresse      (Standard: noel.gruber98@gmail.com)
     ANFRAGE_VON      — Absender              (Standard: onboarding@resend.dev) */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ fehler: 'Nur POST.' });
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const name = str(body.name, 120);
  const mail = str(body.mail, 160);
  const art = str(body.art, 80) || 'Nicht angegeben';
  const text = str(body.text, 5000);

  // Honigtopf: Bots füllen das versteckte Feld aus. Still bestätigen, nichts senden.
  if (str(body.firma, 200)) return res.status(200).json({ ok: true });

  if (!name || !mail || !text) {
    return res.status(400).json({ fehler: 'Name, E-Mail und Beschreibung sind nötig.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
    return res.status(400).json({ fehler: 'Die E-Mail-Adresse ist unvollständig.' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('RESEND_API_KEY fehlt — Anfrage konnte nicht zugestellt werden.');
    return res.status(500).json({ fehler: 'Der Versand ist gerade nicht eingerichtet.' });
  }

  const an = process.env.ANFRAGE_AN || 'noel.gruber98@gmail.com';
  const von = process.env.ANFRAGE_VON || 'Anfrage über die Website <onboarding@resend.dev>';

  try {
    const antwort = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: von,
        to: [an],
        reply_to: mail,
        subject: 'Anfrage von ' + name + ' · ' + art,
        text:
          'Name:     ' + name + '\n' +
          'E-Mail:   ' + mail + '\n' +
          'Thema:    ' + art + '\n' +
          'Eingang:  ' + new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' }) + '\n\n' +
          text + '\n'
      })
    });

    if (!antwort.ok) {
      const detail = await antwort.text();
      console.error('Resend antwortete mit', antwort.status, detail);
      return res.status(502).json({ fehler: 'Der Versand hat nicht geklappt.' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Versand fehlgeschlagen:', e);
    return res.status(502).json({ fehler: 'Der Versand hat nicht geklappt.' });
  }
}

function str(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function safeJson(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
