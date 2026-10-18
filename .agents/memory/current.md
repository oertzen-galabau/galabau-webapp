# Aktueller Stand

## Letzte Änderungen
- **Einsatzplan Tagesansicht**: Timeline 06–20 Uhr, ein Tag ohne Mo–So-Leiste; Tag-Pfeile in Toolbar.
- **Einsatzplan Mitarbeiter-Bereiche**: Tabelle `tenant_work_areas`, `profiles.work_area_id`, Migration `076`; Tab Einstellungen „Mitarbeiter-Bereiche“; Filter nur im Einsatz-Dialog (Chips/Suche); Plan-Ansicht ohne Filterleiste; Permission `settings.work_areas`.
- **Infoboard Tablet (761–1080 px)**: 2-Spalten-Grid (`INFOBOARD_TABLET_COLS`), `layoutForTabletDisplay` (Freigabe volle Breite untereinander, Metriken 2 pro Zeile); Hook `use-infoboard-tablet.ts`; Drag/Resize im Bearbeiten-Modus auf Tablet aus (DB-Layout bleibt 4 Spalten); CSS in `globals.css` (Panel-Kopf, Metrik-Schatten, Job-Zeilen). Tests in `layout.test.ts`.
- **Rebrand BauDiggi** (Code, uncommitted): Metadata, Landing, Footer `contact@baudiggi.de`; npm `baudiggi-baustellenmanagement`; Env-Beispiele `baudiggi.de`.
- **Zeiterfassung Feierabend**: `ClockOutDialog`, kompakte Timeline, Gap-Hilfen in `lib/time-tracking/timeline.ts`.
- **Infoboard UVV**: Widget `equipment_uvv_due`; Migration `075` (`booking_number`).

## Fokus
Production-Rebrand (**baudiggi.de**) und Deploy der offenen Feature-Änderungen; Infoboard auf Tablet kurz visuell prüfen (~900 px).

## Nächste Schritte
- Rebrand + Features committen/deployen (Hostinger Build).
- GitHub: `galabau-webapp` → `baudiggi-webapp` (**offen** — `gh` lokal nicht eingeloggt; SSH-Push auf altes Repo funktioniert); danach `git remote set-url` + Hostinger Git-Deploy.
- Hostinger: DNS `baudiggi.de`/`www`; Env `NEXT_PUBLIC_ROOT_DOMAIN=baudiggi.de`, `NEXT_PUBLIC_PLATFORM_NAME=BauDiggi` (vollständiger Replace + Rebuild).
- SMTP `@baudiggi.de`; 301 `vaerkflow.de` → `baudiggi.de`; Mandanten-URLs `slug.baudiggi.de` kommunizieren.
- Prod-DB Migration `075`; **`076` auf Supabase (galabau) angewendet**; Smoke Einladung/Passwort-Reset; Infoboard UVV aktivieren; Bereiche den Mitarbeitern zuweisen.

## Offene Punkte
- Lokale `.env.local` manuell (BauDiggi, Domain localhost) — nicht committen.
- Deployment-Checkliste GitHub/Hostinger siehe Tabelle unten.
- Feierabend: Start/Ende nur über „Tagesaufteilung anpassen“ — Feedback abwarten.
- SMTP/Impressum/Datenschutz live unvollständig.
- `booking_number`: noch keine Lohnbuchungs-Anbindung.

## Deployment-Checkliste (GitHub + Hostinger)

| # | Aktion |
|---|--------|
| 1 | GitHub Repository rename → `baudiggi-webapp` |
| 2 | Hostinger Git-Deploy auf neue Repo-URL |
| 3 | DNS `baudiggi.de` / `www` → App |
| 4 | Env-Variablen ersetzen + Rebuild |
| 5 | SMTP `@baudiggi.de` |
| 6 | 301 `vaerkflow.de` → `baudiggi.de` |
| 7 | Smoke-Tests Mandanten-Subdomain |
