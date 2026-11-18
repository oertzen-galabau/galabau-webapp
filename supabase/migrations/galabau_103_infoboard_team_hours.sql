-- Infoboard: Gesamtstunden aller Mitarbeitenden nur für Verwaltung/Administrator (Vorarbeiter per Rollenmatrix freischaltbar)

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'infoboard.team_hours', true
FROM tenant_roles tr
WHERE tr.slug IN ('verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
