# Aktueller Stand

## Letzte Änderungen
- **Dokumentation: Tagesbericht vs. Std.-Lohn-Rapport** umgesetzt — `daily_logs.report_type` (`daily_report` | `hourly_wage_rapport`), optional `custom_title`; Formular, Listen, Baustellen-Berichte, PDF-Erzeugung und E-Mail-Versand; Labels in `lib/documentation/report-labels.ts`. Migration `galabau_045_daily_log_report_type.sql` (Remote galabau angewendet).

## Fokus
Manueller Feldtest der zwei Berichtsarten (anlegen, bearbeiten, PDF, optional eigener Titel); Deploy/Migration auf Hostinger-DB falls nötig.

## Nächste Schritte
- Migration `045` auf Prod/Hostinger-DB prüfen bzw. anwenden.
- Tagesbericht + Rapport je einmal durchspielen; Altbestand (nur Rapport-Typ) stichprobenartig.
- Weiterhin offen: Chat-Feldtest, SMTP/Passwort-Reset live.

## Offene Punkte
- SMTP/Impressum/Datenschutz auf Live unvollständig.
- Optional später: mandantenweite Standard-Bezeichnungen für die beiden Berichtsarten in Einstellungen (Branding).
