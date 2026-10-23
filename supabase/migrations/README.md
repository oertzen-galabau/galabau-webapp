-- Produkt: **BauDiggie** (baudiggi.de). Migrationen auf Supabase-Projekt **galabau** (`qivynlutooucifamhaxt`) angewendet.
-- Remote-Versionen: galabau_001_enums … galabau_017_employee_profile

-- Kern-Tabellen: tenants, profiles, sites, time_entries, leave_*, daily_logs, reports, messages, clothing_orders
-- RLS: tenant_id-Isolation via current_tenant_id()
-- Storage: tenant-logos, site-documents, daily-photos, reports

-- Hinweis: GaLaBau-Schema wurde vom falschen Projekt macario.dev entfernt (Rollback galabau_rollback_cleanup).
-- galabau_078_leave_carry_over: Resturlaub Vorjahr (carried_over_source), Verfallsstichtag tenants
-- galabau_079_schedule_day_publications_update: UPDATE-RLS für Tag-Veröffentlichung (Upsert)
-- galabau_080_site_manager_user: Bauleiter (site_manager_user_id), RLS-Zugriff
-- galabau_081_site_team_members_rls: INSERT/DELETE Team (Superadmin, slug-Rolle, Permission)
-- galabau_082_tenant_equipment_superadmin: Flotte/Geräte für Superadmin (SELECT/CRUD)
