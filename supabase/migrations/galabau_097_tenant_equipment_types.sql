-- Mandantenfähige Typen für Fahrzeuge & Geräte (ersetzt tenant_equipment_kind ENUM)

CREATE TABLE IF NOT EXISTS tenant_equipment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_equipment_types_name_trim_chk CHECK (trim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_equipment_types_tenant_name_uidx
  ON tenant_equipment_types (tenant_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS tenant_equipment_types_tenant_sort_idx
  ON tenant_equipment_types (tenant_id, is_active, sort_order, name);

INSERT INTO tenant_equipment_types (tenant_id, name, sort_order)
SELECT t.id, v.name, v.sort_order
FROM tenants t
CROSS JOIN (
  VALUES
    ('Fahrzeug', 10),
    ('Gerät', 20),
    ('Anhänger', 30)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM tenant_equipment_types tet
  WHERE tet.tenant_id = t.id
    AND lower(trim(tet.name)) = lower(trim(v.name))
);

-- Backfill via name mapping from legacy enum (only if kind column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_equipment' AND column_name = 'kind'
  ) THEN
    ALTER TABLE tenant_equipment
      ADD COLUMN IF NOT EXISTS equipment_type_id uuid REFERENCES tenant_equipment_types(id) ON DELETE RESTRICT;

    UPDATE tenant_equipment te
    SET equipment_type_id = tet.id
    FROM tenant_equipment_types tet
    WHERE tet.tenant_id = te.tenant_id
      AND tet.name = CASE te.kind::text
        WHEN 'vehicle' THEN 'Fahrzeug'
        WHEN 'equipment' THEN 'Gerät'
        WHEN 'trailer' THEN 'Anhänger'
        ELSE 'Gerät'
      END
      AND te.equipment_type_id IS NULL;

    ALTER TABLE tenant_equipment
      ALTER COLUMN equipment_type_id SET NOT NULL;

    DROP INDEX IF EXISTS tenant_equipment_tenant_active_idx;
    CREATE INDEX IF NOT EXISTS tenant_equipment_tenant_active_type_idx
      ON tenant_equipment (tenant_id, is_active, equipment_type_id);

    ALTER TABLE tenant_equipment DROP COLUMN kind;
    DROP TYPE IF EXISTS tenant_equipment_kind;
  END IF;
END $$;

ALTER TABLE tenant_equipment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_equipment_types_select ON tenant_equipment_types
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role, 'vorarbeiter'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'partners.view'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY tenant_equipment_types_insert ON tenant_equipment_types
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      public.is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'partners.manage'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY tenant_equipment_types_update ON tenant_equipment_types
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'partners.manage'
          AND trp.granted = true
      )
    )
  )
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_equipment_types_delete ON tenant_equipment_types
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'partners.manage'
          AND trp.granted = true
      )
    )
  );
