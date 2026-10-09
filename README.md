# Noel Gruber — Freelance-Website

Live unter **https://noelgruber.de** · Repository: https://github.com/NoelGru/noelgruber-website

Statische Seite plus eine Funktion für das Anfrageformular. Kein Framework,
kein Build-Schritt: Dateien ändern, hochladen, fertig.

```
index.html        Startseite
impressum.html    Impressum
datenschutz.html  Datenschutzerklärung
stil.css          gesamtes Aussehen, inkl. Schrift-Einbindung
seite.js          Punkteraster, Cursor-Vorschau, Formular
api/anfrage.js    nimmt das Formular entgegen und schickt es per E-Mail
schriften/        Archivo + Instrument Serif, lokal (kein Google-Aufruf)
bilder/           Porträts und Projekt-Screenshots
vercel.json       saubere URLs, Sicherheits-Header, Caching
```

## Vor dem Livegang

**1 · Resend-Konto anlegen** (für den Formularversand, kostenlos bis 3.000 E-Mails/Monat)

- Auf resend.com registrieren, unter *API Keys* einen Schlüssel erzeugen.
- In Vercel unter *Settings → Environment Variables* anlegen:
  - `RESEND_API_KEY` = der Schlüssel
  - `ANFRAGE_AN` = `noel.gruber98@gmail.com` (optional, ist schon der Standard)
- Solange keine eigene Domain da ist, verschickt Resend von `onboarding@resend.dev`.
  Sobald die Domain steht: in Resend verifizieren und `ANFRAGE_VON` auf
  `Anfrage <hallo@deine-domain.de>` setzen. Antworten gehen ohnehin direkt an den
  Absender, der Reply-To ist gesetzt.

**2 · Datenschutzerklärung prüfen lassen.** Der Text beschreibt die Technik korrekt,
ist aber keine Rechtsberatung. Der gelbe Kasten oben in `datenschutz.html` muss raus,
bevor die Seite live geht.

**3 · Offener Punkt: Auftragsverarbeitung und Tarif bei Vercel**

- **Resend** ist erledigt: Der Auftragsverarbeitungsvertrag gilt dort laut DPA automatisch
  für alle Kunden, auch im kostenlosen Tarif. Nichts zu tun.
- **Vercel** bietet den Vertrag laut eigenem DPA nur für Pro und Enterprise an, nicht für
  Hobby. Außerdem ist der Hobby-Tarif laut Fair-Use-Regeln auf nicht-kommerzielle Nutzung
  beschränkt. Beides ist bewusst in Kauf genommen, solange die Seite nichts einbringt.
  Die Datenschutzerklärung behauptet deshalb auch keinen Vertrag mit Vercel.
- Wenn das später sauber werden soll: Vercel Pro (ca. 20 $/Monat), Cloudflare Pages
  (kostenlos, Vertrag gilt auch für Self-Serve-Kunden) oder ein deutscher Hoster
  (2–5 €/Monat, AVV im Kundenbereich, keine USA-Übermittlung).

**4 · Impressum gegenlesen.** Anschrift und §19-Hinweis sind eingetragen, bitte einmal
kontrollieren.

## Veröffentlichen

```bash
npx vercel --prod
```

Beim ersten Mal fragt Vercel nach dem Projektnamen. Danach genügt derselbe Befehl
für jede Aktualisierung.

## Später: Domain

In Vercel unter *Settings → Domains* eintragen, DNS beim Anbieter umstellen.
Danach in `index.html` die `og:image`-Zeile auf die volle Adresse setzen und in
`datenschutz.html` nichts ändern — dort steht nichts Domain-Abhängiges.

## Gut zu wissen

- **Keine Cookies, kein Tracking, keine externen Schriften.** Deshalb kein Cookie-Banner.
  Falls später doch Analyse dazukommt, muss die Datenschutzerklärung erweitert werden.
- **Die Projektbilder** liegen in `bilder/projekte/`. Sie werden 30 Tage lang im
  Browser zwischengespeichert. Wenn ein Bild ausgetauscht wird, muss in `index.html`
  die Versionsnummer dahinter hochgezählt werden (`bepoa.jpg?v=2` → `?v=3`),
  sonst sehen wiederkehrende Besucher wochenlang das alte Bild. Beim Wiesn-Bonblock sind es
  erfundene Beispielbestellungen, keine echten Daten.
- **Die Cursor-Vorschau** in der Projektliste blendet auf Touchgeräten aus; dort wird
  stattdessen ein Bild in der Zeile angezeigt.
- **Das Formular** meldet sich mit einer klaren Fehlermeldung samt E-Mail-Adresse,
  falls der Versand ausfällt — es geht also nie eine Anfrage still verloren.
