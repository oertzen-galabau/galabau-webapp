-- Standorte und Ansprechpartner für Geschäftspartner (Lieferanten & Subunternehmer)

CREATE TABLE IF NOT EXISTS tenant_business_partner_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES tenant_business_partners(id) ON DELETE CASCADE,
  label text NOT NULL,
  street text,
  postal_code text,
  city text,
  phone text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_business_partner_locations_partner_idx
  ON tenant_business_partner_locations (partner_id, is_active);

CREATE TABLE IF NOT EXISTS tenant_business_partner_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES tenant_business_partners(id) ON DELETE CASCADE,
  location_id uuid REFERENCES tenant_business_partner_locations(id) ON DELETE SET NULL,
  name text NOT NULL,
  role_title text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_business_partner_contacts_partner_idx
  ON tenant_business_partner_contacts (partner_id, is_active);

CREATE INDEX IF NOT EXISTS tenant_business_partner_contacts_location_idx
  ON tenant_business_partner_contacts (location_id)
  WHERE location_id IS NOT NULL;

ALTER TABLE site_suppliers
  ADD COLUMN IF NOT EXISTS partner_location_id uuid
    REFERENCES tenant_business_partner_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS site_suppliers_partner_location_idx
  ON site_suppliers (partner_location_id)
  WHERE partner_location_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS site_supplier_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_supplier_id uuid NOT NULL REFERENCES site_suppliers(id) ON DELETE CASCADE,
  partner_contact_id uuid NOT NULL REFERENCES tenant_business_partner_contacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_supplier_id, partner_contact_id)
);

CREATE INDEX IF NOT EXISTS site_supplier_contacts_site_supplier_idx
  ON site_supplier_contacts (site_supplier_id);

-- Bestehende Partner-Kontaktdaten als erster Ansprechpartner
INSERT INTO tenant_business_partner_contacts (
  tenant_id,
  partner_id,
  name,
  phone,
  email
)
SELECT
  bp.tenant_id,
  bp.id,
  COALESCE(NULLIF(trim(bp.contact_person), ''), bp.name),
  bp.phone,
  bp.email
FROM tenant_business_partners bp
WHERE (
  NULLIF(trim(bp.contact_person), '') IS NOT NULL
  OR NULLIF(trim(bp.phone), '') IS NOT NULL
  OR NULLIF(trim(bp.email), '') IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM tenant_business_partner_contacts c
  WHERE c.partner_id = bp.id
);

-- RLS: Standorte
ALTER TABLE tenant_business_partner_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_business_partner_locations_select ON tenant_business_partner_locations
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

CREATE POLICY tenant_business_partner_locations_insert ON tenant_business_partner_locations
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

CREATE POLICY tenant_business_partner_locations_update ON tenant_business_partner_locations
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

CREATE POLICY tenant_business_partner_locations_delete ON tenant_business_partner_locations
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

-- RLS: Ansprechpartner
ALTER TABLE tenant_business_partner_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_business_partner_contacts_select ON tenant_business_partner_contacts
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

CREATE POLICY tenant_business_partner_contacts_insert ON tenant_business_partner_contacts
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

CREATE POLICY tenant_business_partner_contacts_update ON tenant_business_partner_contacts
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

CREATE POLICY tenant_business_partner_contacts_delete ON tenant_business_partner_contacts
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

-- RLS: Baustellen-Ansprechpartner-Zuordnung
ALTER TABLE site_supplier_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY site_supplier_contacts_tenant ON site_supplier_contacts
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
