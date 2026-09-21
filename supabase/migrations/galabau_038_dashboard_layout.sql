-- Persönliches Infoboard-Layout pro User

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dashboard_layout jsonb;

COMMENT ON COLUMN profiles.dashboard_layout IS
  'Persönliche Infoboard-Widget-Konfiguration (Position, Größe, Sichtbarkeit).';

-- Berechtigung infoboard.customize für alle Rollen mit Infoboard-Zugang
INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'infoboard.customize', true
FROM tenant_roles tr
WHERE tr.slug IN ('mitarbeiter', 'vorarbeiter', 'verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
