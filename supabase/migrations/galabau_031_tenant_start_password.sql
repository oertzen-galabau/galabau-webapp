-- Mandantenweites Startpasswort für neue Mitarbeiter und Passwort-Reset aller User
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS default_start_password text;

COMMENT ON COLUMN tenants.default_start_password IS
  'Startpasswort für Mitarbeiter-Accounts; wird bei Anlage und bei Änderung für alle Mandanten-User gesetzt.';

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'settings.start_password', true
FROM tenant_roles tr
WHERE tr.slug IN ('verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
