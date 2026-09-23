# Aktueller Stand

## Letzte Änderungen
- **Passwort-Reset E-Mail**: Kein Fake-Erfolg mehr in Produktion ohne SMTP (`password-reset.ts`, `smtp.ts` try/catch); Build warnt bei fehlenden `SMTP_*`; Hostinger-Anleitung in `.env.local.example`. Live-Versand erfordert Postfach + Env auf Hostinger (MCP-Timeout — manuell in hPanel).
- **Tagesrapport Fotos**: Button „Foto hinzufügen" im selben UI wie Lieferschein (`input-form-file-cta`, Dropdown Hochladen/Foto machen); Vorschau-Thumbnails bleiben in der Grid darüber (`report-photo-manager.tsx`).
- **Registrierung Live-Fix**: try/catch/finally im Register-Formular; `registerTenant` fängt fehlenden `SUPABASE_SERVICE_ROLE_KEY` ab; Build warnt bei fehlendem Key (Commit `5cdf21a`).
- **Berufbezeichnung**: Feld beim Mitarbeiter anlegen (`/app/team`); Speicherung in `profiles.job_title`; automatische Übernahme in Tagesrapport und PDF.
- **Startpasswort**: Aus Team-Formular entfernt; eigener Tab unter `/app/einstellungen?tab=startpasswort`; mandantenweit in `tenants.default_start_password`; Permission `settings.start_password` (Migration `galabau_032`).
- **Fix**: `encType` aus `TenantBrandingForm` entfernt (React-Warnung bei Server Actions).

## Fokus
Passwort-Reset live: SMTP auf Hostinger einrichten, Code deployen, Forgot-Password E2E testen.

## Nächste Schritte
- **Hostinger hPanel → E-Mail:** Postfach `noreply@vaerkflow.de` anlegen.
- **Node.js Env (FULL REPLACE):** bestehende Keys behalten + `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`/`SMTP_FROM=noreply@vaerkflow.de`, `SMTP_PASSWORD`, ggf. `PASSWORD_RESET_PEPPER` (falls noch nicht gesetzt).
- Build/Redeploy, dann `/forgot-password` testen (Spam-Ordner).
- Hostinger: `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_ROOT_DOMAIN=vaerkflow.de` setzen und Redeploy — danach Registrierung live testen.
- Tagesrapport: Fotos per Hochladen/Kamera hinzufügen, min./max.-Validierung prüfen.
- Startpasswort-Flow und Berufbezeichnung im Rapport/PDF durchspielen.

## Offene Punkte
- Live-Registrierung hängt ohne `SUPABASE_SERVICE_ROLE_KEY` auf Hostinger (Code zeigt jetzt Fehlermeldung statt endlos „Wird eingerichtet…").
- SMTP auf Live noch nicht konfiguriert (Code + Doku bereit); Impressum/Datenschutz weiterhin offen.
- Sechs Payroll-Tabellen ohne RLS (separates Sicherheits-Thema).
- Branding optional auf Login/PDF.
- Startpasswort liegt als Klartext in der DB (Admin-only, bewusst für Betriebs-Workflow).
