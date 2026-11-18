-- Infoboard: Beiträge lesen (ohne Veröffentlichen) — bisher implizit über nav.infoboard

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT DISTINCT trp.tenant_role_id, 'infoboard.view_posts', true
FROM tenant_role_permissions trp
WHERE trp.permission_key IN ('nav.infoboard', 'infoboard.posts')
  AND trp.granted = true
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
