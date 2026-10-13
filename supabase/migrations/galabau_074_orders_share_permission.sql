-- Bestellformular per PDF/E-Mail (orders.share)

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'orders.share', true
FROM tenant_roles tr
WHERE tr.slug IN ('verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
