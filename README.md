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
api/tour.js       liefert /touren/<tour> mit Titel und Vorschaubild für geteilte Links
projekte/         Projektseiten (z. B. /projekte/lead-data-hub), Aussehen in projekt.css
touren/           Tourenbuch: Seite, Aussehen, Logik, supabase-js (lokal)
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

Das Repository ist mit Vercel verbunden. **Jeder Push auf `main` deployt automatisch
nach https://noelgruber.de:**

```bash
git add -A && git commit -m "Was geändert wurde" && git push
```

Pushes auf andere Branches erzeugen eine Vorschau-Adresse, ohne die Live-Seite anzufassen.
Notfalls geht weiterhin ein Deployment von Hand mit `npx vercel --prod`.

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

## Tourenbuch (/touren)

Meine Wanderungen, öffentlich unter https://noelgruber.de/touren, jede Tour mit eigenem
Link (`/touren/<tour>`). Daten und Fotos liegen im Supabase-Projekt **tourenbuch**
(Region Frankfurt): Tabelle `tours` (`id` = Link-Name, `data` = alle Angaben als JSON) und
der öffentliche Speicher `fotos`. Lesen darf jeder, schreiben nur die Adresse
`noel.gruber98@gmail.com` (Row Level Security).

- **Eintragen:** unten auf der Seite „Anmelden“, Login-Link kommt per Mail.
- **Einmalig in Supabase einstellen**, sonst führt der Login-Link ins Leere:
  *Authentication → URL Configuration* → Site URL `https://noelgruber.de`,
  Redirect URLs `https://noelgruber.de/touren**`.
- Kostenlose Supabase-Projekte pausieren nach etwa einer Woche ohne Aufrufe; im
  Dashboard wieder starten.
- Offener Punkt wie bei Vercel: ob für Supabase ein Vertrag zur Auftragsverarbeitung
  besteht, ist noch nicht geprüft. Die Datenschutzerklärung behauptet keinen.

## Bewerbungen (/bewerbungen, privat)

Nachfolger der lokalen Bewerbungsspur. Nirgends verlinkt, nicht in der Sitemap, nicht in
`robots.txt` (sonst wäre der Pfad öffentlich), `noindex, nofollow` per Meta-Tag und
`X-Robots-Tag`. Ohne Anmeldung zeigt die Seite nur die Login-Maske und lädt keine Daten.

- **Daten:** Supabase-Projekt **tourenbuch**, Tabelle `bewerbungen`. Row Level Security:
  lesen, anlegen, ändern, löschen nur für `user_id = auth.uid()`, `anon` hat keine Rechte.
- **Auslesen der Stellenanzeige:** Edge Function `stelle-lesen` (Quelltext unter
  `supabase/functions/`, wird in Supabase deployt, `.vercelignore` hält ihn von der Website fern).
  Nimmt nur Aufrufe mit echter Sitzung an.
- **Login-Link:** In Supabase unter *Authentication → URL Configuration* muss
  `https://noelgruber.de/bewerbungen**` in den Redirect URLs stehen.
- Dateien: `bewerbungen/index.html`, `bewerbungen.css` (baut auf `stil.css` auf), `bewerbungen.js`.

## Projektseiten (/projekte)

Ausführliche Seiten zu einzelnen Projekten, öffentlich und in der Sitemap. Aufbau wie die
Startseite (`stil.css`, `seite.js`), Ergänzungen in `projekte/projekt.css`.

- **Lead Data Hub** (`/projekte/lead-data-hub`): Referenzprojekt für Bewerbungen. Code im
  Repository `NoelGru/lead-data-hub`. Die Screenshots in `bilder/projekte/lead-data-hub/`
  gibt es hell und dunkel; angezeigt wird, was zur gewählten Ansicht passt. Alle Firmen und
  Personen darin sind erfunden (eigene Demo-Datenbank, keine echten Konten sichtbar).

## Customer Health Dashboard, neutrale Projektseite (/projekte/customer-health-dashboard)

Allgemeine Projektseite ohne Firmen- oder Bewerbungsbezug: `projekte/customer-health-dashboard.html`.
Indexierbar, in der Sitemap und als Karte auf der Startseite. Bilder in
`bilder/projekte/customer-health-dashboard/` (ohne noindex-Header, Überschrift „Customer Success · Parkflächen“), Karte
`bilder/projekte/customer-health-dashboard/karte.jpg`.

## Customer Health Dashboard (/customerhealth, nicht indexiert)

Kurzseite zum Verschicken: `projekte/customer-health.html` (https://noelgruber.de/projekte/customer-health), ausführliche Version: `projekte/customer-health/details.html` (/projekte/customer-health/details).
Bewusst nur per Link erreichbar: `noindex` (Meta-Tag und Header), nicht in der Sitemap und keine
Karte auf der Startseite. Gedacht zum Verschicken an Wemolo. Screenshots in
`bilder/projekte/customer-health/` (nur hell, das Dashboard hat keine dunkle Ansicht).

Das Dashboard selbst:

Bewerbungs-Prototyp, erreichbar unter https://noelgruber.de/customerhealth, aber nicht in der
Sitemap und mit `X-Robots-Tag: noindex, nofollow`. Die Seite liegt nicht in diesem Repo:
`vercel.json` leitet `/customerhealth` per Rewrite an das Vercel-Projekt **customer-health**
weiter (Repository `NoelGru/customer-health`, Adresse `customer-health-snowy.vercel.app`).
Änderungen am Dashboard also dort pushen, hier ist nichts zu tun.
