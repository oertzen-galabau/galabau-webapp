# Aktueller Stand

## Letzte Änderungen
- **Mandanten-Branding** (`/app/einstellungen`, Tab Allgemein): Logo-Upload über Bucket `tenant-logos`, 5 Farben (Primär, Akzent, Seitenleiste, Seitenleisten-Text, Arbeitsfläche), HEX-Eingabe neben Color-Picker.
- Migration `galabau_026_tenant_theme`: `sidebar_color`, `sidebar_text_color`, `surface_color` auf `tenants`.
- Theme via `tenantThemeStyle()` → CSS-Tokens `--brand`, `--accent`, `--sidebar`, `--sidebar-text`, `--surface`.
- Sidebar: hochgeladenes Logo ohne Box; ohne Logo Standard-Icon in `brand-symbol`-Box.
- UI: `TenantBrandingForm`, Actions `updateTenantBranding` / `removeTenantLogo` (Permission `settings.branding`).

## Fokus
Branding in der App testen (Logo hochladen/ersetzen/entfernen, Farben speichern, Sidebar + Arbeitsfläche prüfen).

## Nächste Schritte
- Logo-Upload und Farbanpassung mit echtem Mandanten durchspielen.
- Optional: Mandanten-Branding auf Login-Seite oder in PDF-Rapporten.

## Offene Punkte
- SMTP/Impressum/Datenschutz weiterhin offen.
- Chat: kein Paginieren, keine Gruppen, keine Anhänge (v1).
- Branding-Vorschau bewusst entfernt.
