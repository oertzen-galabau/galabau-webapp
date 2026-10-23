-- Berechtigung: Baustellen-Darstellung (Icon & Titelbild)
INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT trp.tenant_role_id, 'sites.appearance', true
FROM tenant_role_permissions trp
WHERE trp.permission_key = 'sites.manage'
  AND trp.granted = true
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'sites.appearance', true
FROM tenant_roles tr
WHERE tr.slug IN ('vorarbeiter', 'verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
