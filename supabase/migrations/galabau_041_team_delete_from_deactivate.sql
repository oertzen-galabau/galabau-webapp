-- Wer Mitarbeiter deaktivieren darf, darf sie auch löschen (falls noch nicht gesetzt).
INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tenant_role_id, 'team.delete', granted
FROM tenant_role_permissions
WHERE permission_key = 'team.deactivate'
  AND granted = true
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
