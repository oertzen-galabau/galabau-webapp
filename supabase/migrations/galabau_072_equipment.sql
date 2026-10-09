-- Fahrzeuge & Geräte (Stammdaten) + Einsatzplanung-Zuordnung

CREATE TYPE tenant_equipment_kind AS ENUM ('vehicle', 'equipment', 'trailer');
CREATE TYPE tenant_equipment_status AS ENUM ('active', 'workshop', 'retired');

CREATE TABLE IF NOT EXISTS tenant_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind tenant_equipment_kind NOT NULL,
  name text NOT NULL,
  photo_path text,
  build_year int,
  serial_number text,
  inventory_number text,
  uvv_due_date date,
  license_plate text,
  manufacturer_model text,
  inspection_due_date date,
  operating_hours numeric(12, 2),
  mileage_km numeric(12, 2),
  license_class_required text,
  status tenant_equipment_status NOT NULL DEFAULT 'active',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_equipment_build_year_chk CHECK (build_year IS NULL OR (build_year >= 1950 AND build_year <= 2100))
);

CREATE INDEX IF NOT EXISTS tenant_equipment_tenant_active_idx
  ON tenant_equipment (tenant_id, is_active, kind);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_equipment_tenant_inventory_uidx
  ON tenant_equipment (tenant_id, lower(trim(inventory_number)))
  WHERE inventory_number IS NOT NULL AND trim(inventory_number) <> '';

CREATE TABLE IF NOT EXISTS schedule_entry_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  schedule_entry_id uuid NOT NULL REFERENCES schedule_entries(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES tenant_equipment(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_entry_id, equipment_id)
);

CREATE INDEX IF NOT EXISTS schedule_entry_equipment_equipment_idx
  ON schedule_entry_equipment (tenant_id, equipment_id);

ALTER TABLE tenant_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entry_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_equipment_select ON tenant_equipment
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role, 'vorarbeiter'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'partners.view'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY tenant_equipment_insert ON tenant_equipment
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'partners.manage'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY tenant_equipment_update ON tenant_equipment
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'partners.manage'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY tenant_equipment_delete ON tenant_equipment
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'partners.manage'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY schedule_entry_equipment_select ON schedule_entry_equipment
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.user_can_schedule_manage()
      OR EXISTS (
        SELECT 1 FROM schedule_entries se
        WHERE se.id = schedule_entry_equipment.schedule_entry_id
          AND public.schedule_week_is_published(
            se.tenant_id,
            public.schedule_entry_week_start(se.start_date)
          )
      )
    )
  );

CREATE POLICY schedule_entry_equipment_insert ON schedule_entry_equipment
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_manage()
  );

CREATE POLICY schedule_entry_equipment_delete ON schedule_entry_equipment
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_manage()
  );

-- Storage-Bucket equipment-photos (privat, Mandanten-Pfad)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'equipment-photos',
  'equipment-photos',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS site_docs_tenant_select ON storage.objects;
CREATE POLICY site_docs_tenant_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['site-documents'::text, 'daily-photos'::text, 'reports'::text, 'equipment-photos'::text])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

DROP POLICY IF EXISTS site_docs_tenant_insert ON storage.objects;
CREATE POLICY site_docs_tenant_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY['site-documents'::text, 'daily-photos'::text, 'reports'::text, 'equipment-photos'::text])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

DROP POLICY IF EXISTS site_docs_tenant_update ON storage.objects;
CREATE POLICY site_docs_tenant_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['site-documents'::text, 'daily-photos'::text, 'reports'::text, 'equipment-photos'::text])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = ANY (ARRAY['site-documents'::text, 'daily-photos'::text, 'reports'::text, 'equipment-photos'::text])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );

DROP POLICY IF EXISTS site_docs_tenant_delete ON storage.objects;
CREATE POLICY site_docs_tenant_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['site-documents'::text, 'daily-photos'::text, 'reports'::text, 'equipment-photos'::text])
    AND (storage.foldername(name))[1] = current_tenant_id()::text
  );
