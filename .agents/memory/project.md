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
- **Wetter Baustellen**: Open-Meteo in `lib/weather/*`; Geocoding der Freitext-Adresse → `sites.latitude/longitude`; Anzeige nur auf Baustellen-Detailseite; Berechtigung via bestehendem `nav.baustellen`/`sites.view`.
- **Nachrichten (1:1-Chat)**: WhatsApp-Layout unter `/app/nachrichten` + `/app/nachrichten/[userId]`; Tabelle `messages` mit `sender_id`/`recipient_id`, Zustell-/Lesestatus; RLS sender/recipient-only; Supabase Realtime; Logik in `lib/messages/*`, UI in `components/messages/*`; Permission `messages.send`/`nav.nachrichten`.
- **Mandanten-Branding**: `tenants.logo_url` + Farbfelder; Upload in public Bucket `tenant-logos`; Theme-Overrides in `lib/tenant/resolve.ts`; UI `components/settings/tenant-branding-form.tsx`; Permission `settings.branding`.

## Entscheidungen & Constraints
- **Pflicht bei jeder neuen Funktion**: Neue Features müssen immer in Rollen & Berechtigungen hinterlegt werden — Permission-Key in `lib/auth/permissions.ts` (Katalog + ggf. Default-Sets), Guards via `canAccess()` auf Seiten/Actions/APIs, optional Nav-Eintrag mit eigenem Key. Ohne Permission-Integration gilt ein Feature als nicht fertig.
- Permission-Keys im Code (versionierbar); Matrix speichert nur Zuordnungen in der DB.
- Mindestens eine Rolle behält `roles.manage`; System-Rollen nicht löschbar.
- Superadmin: voller Zugriff ohne Impersonation; Enum `profiles.role` vorerst für Sync/Legacy.
- Deployment-Ziel: Node.js-Hosting (Hostinger VPS), Domain `vaerkflow.de`.
