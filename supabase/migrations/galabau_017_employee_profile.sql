-- Extended employee profile fields and personal notes

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS personnel_number text,
  ADD COLUMN IF NOT EXISTS salutation text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS entry_date date,
  ADD COLUMN IF NOT EXISTS exit_date date,
  ADD COLUMN IF NOT EXISTS job_title text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_tenant_personnel_number_idx
  ON profiles (tenant_id, personnel_number)
  WHERE personnel_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS employee_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS employee_notes_user_id_idx ON employee_notes(user_id);
CREATE INDEX IF NOT EXISTS employee_notes_tenant_id_idx ON employee_notes(tenant_id);

ALTER TABLE employee_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_notes_select ON employee_notes
  FOR SELECT USING (tenant_id = current_tenant_id() OR is_superadmin());

CREATE POLICY employee_notes_insert ON employee_notes
  FOR INSERT WITH CHECK (
    tenant_id = current_tenant_id()
    AND has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
  );

-- Seed new team permissions for roles that already have roles.manage
INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT trp.tenant_role_id, new_perm, true
FROM tenant_role_permissions trp
CROSS JOIN (
  VALUES
    ('team.edit_profile'),
    ('team.deactivate'),
    ('team.notes'),
    ('team.password_reset')
) AS p(new_perm)
WHERE trp.permission_key = 'roles.manage'
  AND trp.granted = true
ON CONFLICT (tenant_role_id, permission_key) DO NOTHING;
