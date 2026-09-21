# Projekt: Værkflow – Baustellenmanagement (SaaS)

## Ziel
Cloud-SaaS für GaLaBau-/Bau-Betriebe: mandantenfähige Web-App für Arbeitszeiterfassung, Tagesdokumentation, Urlaubsverwaltung, Baustellenakten und PDF-Rapporte. Zielgruppe: Bauunternehmen (Mitarbeiter, Vorarbeiter, Verwaltung) sowie Plattform-Betreiber (Superadmin). Vertrieb über Marketing-Landingpage mit **7-Tage-Test** und Self-Service-Registrierung (`/register`).

## Tech-Stack
- **Next.js 16** (App Router), React 19, TypeScript, Tailwind CSS v4.
- Supabase (Postgres, Auth, Storage) — Projekt **galabau** (MCP: `user-supabase_galabau`).
- E-Mail: `nodemailer`/SMTP; PDF-Rapporte: `pdf-lib`; Icons: `lucide-react`.

## Architektur
- Routing: `/` Marketing, `/register`, `/login`, `/app/*` (inkl. `/app/rollen`), `/superadmin`, `/showcase`.
- Mandantenauflösung: Subdomain (`lib/tenant/resolve.ts`, `middleware.ts`).
- **Rollenmodell**: `tenant_roles` (System + Custom pro Mandant), `tenant_role_permissions`, `profiles.tenant_role_id`. Superadmin plattformweit (`role = superadmin`, max. 1).
- **Berechtigungen**: Permission-Katalog in `lib/auth/permissions.ts` (~31 Keys: Nav + Aktionen); Prüfung via `canAccess()` / `getActionContext()` in `lib/auth/session.ts`.
- Dev-Impersonation: Cookie `dev_role_override` = `tenant_role_id` (nur Development).
- Server Actions: `lib/actions/{admin,employee,payroll,permissions,superadmin,register,password-reset,dev-role}.ts`.
- **Lohnregeln**: Mandanten-Config (`payroll_tenant_rules`, `payroll_booking_codes`); UI in `/app/einstellungen?tab=lohnregeln` via `PayrollRuleMatrix` (Dialog-Bearbeitung, keine Unterseite mehr).
- **Schlechtwetter (KUG)**: Mitarbeiter melden per Checkbox (`time_entries.bad_weather_claimed`); Vorarbeiter markieren ganze Tage (`bad_weather_days`) in Freigabe; Saison (`season_start`/`season_end` in Regel-Config, Default Dez.–Mär.) steuert UI und Buchung 8110; Logik in `lib/payroll/constants.ts`, `lib/payroll/bad-weather-entry.ts`.
- **Baustellen-Adresse**: Strukturiert als `street`, `zip_code`, `city` auf `sites`; kombiniertes `address` via `lib/sites/format-address.ts` für Geocoding, Wetter, PDF und Rapporte.
- **Baustellen-Akte**: Detailseite mit Stammdaten, Kontakten, Lieferanten, **Rapporte** (`SiteReportsSection`), Wetter, Terminen, Dokumenten; Rapporte gefiltert per `site_id`.
- **Wetter Baustellen**: Open-Meteo in `lib/weather/*`; Geocoding über formatierte Adresse → `sites.latitude/longitude`; Anzeige auf Baustellen-Detailseite; Berechtigung via `nav.baustellen`/`sites.view`.
- **Nachrichten (1:1-Chat)**: WhatsApp-Layout unter `/app/nachrichten` + `/app/nachrichten/[userId]`; Tabelle `messages` mit `sender_id`/`recipient_id`, `read_at`/`delivered_at`; Unread-Badge in Haupt-Sidebar (`TenantShell`, Realtime); „Als ungelesen markieren" in Kontaktliste; Actions `getUnreadMessageCount`/`markConversationRead`/`markConversationUnread` in `employee.ts`; RLS sender/recipient-only; Supabase Realtime; Logik in `lib/messages/*`, UI in `components/messages/*`; Permission `messages.send`/`nav.nachrichten`.
- **Mandanten-Branding**: `tenants.logo_url` + Farbfelder; Upload in public Bucket `tenant-logos`; Theme-Overrides in `lib/tenant/resolve.ts`; UI `components/settings/tenant-branding-form.tsx`; Permission `settings.branding`.
- **Mandanten-Startpasswort**: `tenants.default_start_password`; Tab `/app/einstellungen?tab=startpasswort`; bei Anlage neuer Mitarbeiter und bei Änderung für alle Mandanten-User; Permission `settings.start_password`; Lesen nur über Admin-Client (Spalten-Privileg).
- **Mitarbeiter-Stammdaten**: `profiles.job_title` (Berufbezeichnung); Anlage unter `/app/team`, Pflege in Stammdaten; Übernahme in Tagesrapport/PDF.

## Entscheidungen & Constraints
- **Pflicht bei jeder neuen Funktion**: Neue Features müssen immer in Rollen & Berechtigungen hinterlegt werden — Permission-Key in `lib/auth/permissions.ts` (Katalog + ggf. Default-Sets), Guards via `canAccess()` auf Seiten/Actions/APIs, optional Nav-Eintrag mit eigenem Key. Ohne Permission-Integration gilt ein Feature als nicht fertig.
- Permission-Keys im Code (versionierbar); Matrix speichert nur Zuordnungen in der DB.
- Mindestens eine Rolle behält `roles.manage`; System-Rollen nicht löschbar.
- Superadmin: voller Zugriff ohne Impersonation; Enum `profiles.role` vorerst für Sync/Legacy.
- Deployment-Ziel: Node.js-Hosting (Hostinger VPS), Domain `vaerkflow.de`.
