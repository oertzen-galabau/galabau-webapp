-- GPS / Standortfunktionen pro Mandant ein- oder ausschalten
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS gps_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN tenants.gps_enabled IS
  'Wenn false, nutzt die App keine Geräte-Ortung (Header-Wetter, Standort bei Unterschriften, Wetter per Standort).';

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'settings.gps', true
FROM tenant_roles tr
WHERE tr.slug IN ('verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
