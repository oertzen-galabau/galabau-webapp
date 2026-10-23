-- Infoboard: alle Einsätze (heute/morgen) für Planer-Rollen

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'infoboard.schedule_all', true
FROM tenant_roles tr
WHERE tr.slug IN ('vorarbeiter', 'verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
