-- Referenz: Mandanten-RLS-Audit (2026-10-09)
-- Die Baseline-Migrationen galabau_001–013 liegen nicht im Repo (siehe supabase/migrations/README.md).
-- Ab galabau_014 sind alle Schema-Änderungen versioniert; Mandanten-Härtung ab galabau_057–062.
--
-- Kernprinzipien (Live nach galabau_062):
-- 1. Alle Mandantentabellen: RLS + tenant_id = current_tenant_id() (Payroll ab 058).
-- 2. Superadmin: nur Inhalte des geöffneten Mandanten (current_tenant_id inkl. x-tenant-slug Header, galabau_060).
-- 3. profiles: Trigger profiles_guard_sensitive_columns; keine Client-Updates auf tenant_id/role/tenant_role_id.
-- 4. Storage: Pfadpräfix = tenant_id (galabau_059); Service-Role-Zugriffe zusätzlich in der App absichern.
-- 5. messages: tenant_id in SELECT/UPDATE; immutable-field Trigger.
-- 6. anon: kein Tabellenzugriff im public-Schema (galabau_061).

COMMENT ON SCHEMA public IS 'Multi-tenant GaLaBau app; RLS enforced. See galabau_057–062 for security hardening.';
