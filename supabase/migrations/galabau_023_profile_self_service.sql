-- Self-Service Profil: Berechtigungen für alle Mandanten-Rollen

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, perm.key, true
FROM tenant_roles tr
CROSS JOIN (
  VALUES
    ('profile.edit_self'),
    ('profile.change_email'),
    ('profile.change_password')
) AS perm(key)
ON CONFLICT (tenant_role_id, permission_key) DO NOTHING;
