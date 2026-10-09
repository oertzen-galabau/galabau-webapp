-- Berichte: Mitarbeiter nav.baustellen; Vorarbeiter+ sehen alle Berichte (documentation.view_all)

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'nav.baustellen', true
FROM tenant_roles tr
WHERE tr.slug = 'mitarbeiter'
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'documentation.view_all', true
FROM tenant_roles tr
WHERE tr.slug IN ('vorarbeiter', 'verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
