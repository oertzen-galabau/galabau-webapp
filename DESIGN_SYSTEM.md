# Designsystem Værkflow

Værkflow ist die verbindliche visuelle Grundlage der Anwendung. Das System verbindet robuste, kontrastreiche Arbeitsoberflächen mit großen, klaren Aktionen für Büro und Baustelle.

## Repo-Zweck

Dieses Repository enthält das **Design System Værkflow (02)** und die **Multi-Tenant SaaS-App** für Baustellenmanagement. Die Showcase unter `/showcase` demonstriert Tokens und Komponenten. Die Produkt-App läuft unter `/app` (Tenant) bzw. `/` (Marketing).

### Routen

| Route | Zweck |
| --- | --- |
| `/` | Öffentliche Marketing-Landingpage |
| `/login` | Anmeldung |
| `/app` | Infoboard (Tenant-App) |
| `/app/zeiten` | Arbeitszeiterfassung |
| `/app/urlaub` | Urlaub & Fehlzeiten |
| `/app/baustellen` | Baustellenakte |
| `/app/dokumentation` | Tagesdokumentation |
| `/app/rapporte` | PDF-Rapporte |
| `/superadmin` | Plattform-Owner (Mandantenverwaltung) |
| `/showcase` | Design-System-Demo |

### Entwicklung starten

```bash
npm run dev
```

Die Startseite zeigt direkt die Værkflow-Showcase — ohne Konzept-Auswahl oder Markenwechsel.

### Showcase-Bereiche

| Bereich | Komponenten-Zweck |
| --- | --- |
| Übersicht | Kennzahlenkarten, Einsatzliste, Projektfortschritt, Seitenleiste |
| Aufträge | Auftragsdetail, Aufgabenliste, Meta-Infos, Schnellzugriff |
| Zeiten | Mobile Zeiterfassung, Timer-Zustände, Quick-Capture |
| Dokumente | Dokumentenkarten, Upload-Aktion |
| Team | Teamliste, Status-Indikatoren, Stundenübersicht |

## Gestaltungsprinzipien

- Direkt: Wichtige Aktionen sind kräftig, kontrastreich und eindeutig beschriftet.
- Robust: Kleine Radien, sichtbare Konturen und versetzte Schatten erzeugen handwerkliche Prägnanz.
- Funktional: Statusfarben tragen Bedeutung; Orange bleibt der primären Interaktion vorbehalten.
- Responsive: Desktop nutzt Navigation und Informationsdichte, Mobile priorisiert Touch-Ziele und den aktuellen Arbeitsablauf.

## Tokens

Die zentrale Quelle ist `app/globals.css`. Rohfarben sind als `--color-*` benannt; Komponenten verwenden ausschließlich semantische Tokens.

| Rolle | Token | Wert |
| --- | --- | --- |
| Primärsignal | `--brand` | `#ef684a` |
| Hervorhebung | `--accent` | `#f2c94c` |
| Text / Navigation | `--text`, `--sidebar` | `#202b33` |
| Arbeitsfläche | `--surface` | `#eeeae3` |
| Kartenfläche | `--surface-raised` | `#fffdf8` |
| Gedämpfte Fläche | `--surface-muted` | `#e1ddd6` |
| Sekundärtext | `--text-soft` | `#687176` |
| Trennlinien | `--line` | `#d5d0c8` |
| Erfolg | `--success` | `#2f8b65` |
| Warnung | `--warning` | `#c98a19` |
| Fehler | `--danger` | `#c54c3b` |
| Tastaturfokus | `--focus` | `#1672dd` |

## Typografie

- Barlow ist die Display-Schrift für Seitenüberschriften, Kennzahlen und Abschnittstitel.
- Inter ist die UI-Schrift für Navigation, Fließtext, Tabellen und Bedienelemente.
- Große Überschriften sind fett und in Versalien.

### Größen-Skala (CSS-Tokens in `app/globals.css`)

| Token | Größe | Verwendung |
| --- | --- | --- |
| `--text-ui` | 14px | **Minimum** für Fließtext, Buttons, Listen, Tabellen-Zellen, Form-Labels, Suche |
| `--text-body-soft` | 14px | Gedämpfte Beschreibungen (Farbe `--text-soft`) |
| `--text-caption` | 12px | Einzige Ausnahme: Uppercase-Eyebrows, Tabellen-Header, Mobile-Nav-Labels, Kbd-Hints |
| Display (H1–H3, Kennzahlen) | 17px+ | Unverändert, Barlow, teils Versalien |

App-Formulare (`input-form`) nutzen kompakte 14px-Eingaben; Auth-Seiten behalten größere Submit-Buttons (44px) für Touch-Bedienbarkeit.

## Input-Form (Standard-Eingabebox)

Alle Eingabeboxen in der App, Auth und im Superadmin folgen dem gleichen Layout wie „Neuer Zeiteintrag“:

- **Wrapper:** `panel form-panel` — kompaktes Padding, Überschrift in Versalien (`--text-caption`)
- **Formular:** `input-form` — vertikaler Stack
- **Kernfelder:** `input-form-core` — 4-Spalten-Grid (Desktop), 2 Spalten ab 720px, 1 Spalte in schmalen Auth-Karten
- **Optionale Felder:** `input-form-extra` — `<details>` mit Plus/Minus-Prefix (z. B. Notiz, Pausen)
- **Aktion:** `input-form-actions` — Submit rechtsbündig; in der App `primary-button--compact`, in Auth `primary-button`
- **Volle Breite:** `input-form-span-full` für Textareas; `input-form-span-2` für halbe Breite
- **Mehrere Abschnitte:** `input-form-section` + `input-form-section-title` (z. B. Tagesdokumentation)
- **Dynamische Zeilen:** `input-form-row-list-*` — mehrzeilige Eingabe mit +/Papierkorb pro Zeile (Baustellen-Detail, Tagesdokumentation); Papierkorb immer sichtbar, bei einer Zeile deaktiviert
- **Baustellen-Detail:** `site-meta-form`, `site-entity-row`, `site-detail-section` — Stammdaten inline, gespeicherte Einträge mit Löschen, Touch-Ziele ≥44px

## Form und Tiefe

- Kartenradius: `--radius` mit 4 px.
- Kleine Bedienelemente: `--radius-small` mit 3 px.
- Tiefe entsteht über harte, versetzte Schatten statt weicher Schwebeeffekte.
- Primärbuttons besitzen eine dunkle Kontur und einen sichtbaren Versatzschatten.

## Komponentenregeln

- Primäraktionen verwenden Orange, dunkle Schrift und mindestens 42 px Höhe.
- Karten nutzen die helle Papierfläche; Kennzahlenkarten erhalten eine stärkere Kontur.
- Aktive Navigation kombiniert Orange mit einer gelben Innenkante.
- Status-Badges verwenden ausschließlich die semantischen Statusfarben.
- Fokus bleibt mit einem 3 px starken blauen Ring deutlich sichtbar.
- Mobile Touch-Ziele sind mindestens 44 × 44 px groß.

## Responsive Verhalten

- Ab 1080 px wird das Dashboard dichter und die Seitenleiste breiter dargestellt.
- Unter 760 px wechseln Seitenleiste und Desktop-Kopfzeile zu Menü, kompakter Kopfzeile und fester Tab-Navigation.
- Sekundäre Desktop-Inhalte werden mobil zugunsten der Kernaufgabe ausgeblendet.
