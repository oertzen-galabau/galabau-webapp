# Aktueller Stand

## Letzte Änderungen
- **Bestellformular PDF + Mail**: VO-Vorlage (`docs/VO Bestellformular.pdf`) — Einzel-PDF pro `catalog_order`, Sammel-PDF mit Übersichtsseite; ohne Eigenanteil; `lib/orders/pdf.ts`, `GET /api/orders/pdf`, `POST /api/orders/send` (SMTP); Permission `orders.share`; Admin-Tab „Alle Bestellungen“ (PDF/Mail, Mehrfachauswahl, Status „Bestellt“ nach Versand); Mitarbeiter eigener PDF-Download. Migration `074` auf Supabase galabau angewendet.
- **Einsatzplanung (Tagesmodell)**: Migration `073` — Tag pro Einsatz, `schedule_day_publications`, Tages-PDF/Druck/Teilen/E-Mail.
- **Dokumentation**: Subunternehmer Std.-Lohn-Rapport; Wetter-Vorlage; Tagesbericht Lieferblöcke; Geschäftspartner-Stammdaten.

## Fokus
Nach Deploy: Bestell-PDF einzeln/Sammel + E-Mail an Lieferant; Einsatzplan Tag veröffentlichen → PDF. Dokumentation/Wetter kurz gegenprüfen.

## Nächste Schritte
- Hostinger-Deploy + Hard-Refresh; `074` auf Prod-DB falls Mandant noch ohne `orders.share` in der Matrix.
- SMTP live testen (Bestellungen nutzen dieselbe Konfiguration wie Einsatzplan/Rapporte).
- Einsatzplan Mitarbeiter-Sicht (nur veröffentlichte Tage).

## Offene Punkte
- SMTP/Impressum/Datenschutz auf Live unvollständig.
- Optional später: Standard-Lieferanten-E-Mail als Mandanten-Einstellung.
- Build-Typecheck: gelegentlich `.next` Duplicate `LayoutProps` (lokal `rm -rf .next`).
