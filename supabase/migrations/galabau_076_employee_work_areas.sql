-- Mitarbeiter-Bereiche pro Mandant (Einsatzplan-Filter, Team-Stammdaten)

CREATE TABLE IF NOT EXISTS tenant_work_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  schedule_assignable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS tenant_work_areas_tenant_sort_idx
  ON tenant_work_areas (tenant_id, is_active, sort_order, name);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS work_area_id uuid REFERENCES tenant_work_areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_work_area_idx
  ON profiles (work_area_id)
  WHERE work_area_id IS NOT NULL;

INSERT INTO tenant_work_areas (tenant_id, name, sort_order, schedule_assignable)
SELECT t.id, v.name, v.sort_order, v.schedule_assignable
FROM tenants t
CROSS JOIN (
  VALUES
    ('Geschäftsführung', 10, false),
    ('Verwaltung', 20, false),
    ('Baustelle', 30, true),
    ('Werkstatt/Lager', 40, true)
) AS v(name, sort_order, schedule_assignable)
ON CONFLICT (tenant_id, name) DO NOTHING;

ALTER TABLE tenant_work_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_work_areas_select ON tenant_work_areas
  FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_work_areas_insert ON tenant_work_areas
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('settings.work_areas'::text)
    )
  );

CREATE POLICY tenant_work_areas_update ON tenant_work_areas
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('settings.work_areas'::text)
    )
  )
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_work_areas_delete ON tenant_work_areas
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('settings.work_areas'::text)
    )
  );

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, perm.key, true
FROM tenant_roles tr
CROSS JOIN (VALUES ('settings.work_areas')) AS perm(key)
WHERE tr.slug IN ('verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
