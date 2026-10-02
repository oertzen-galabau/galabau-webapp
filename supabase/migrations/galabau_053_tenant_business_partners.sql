-- Mandanten-Stammdaten: Subunternehmer & Lieferanten

CREATE TYPE business_partner_kind AS ENUM ('supplier', 'subcontractor');

CREATE TABLE IF NOT EXISTS tenant_business_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind business_partner_kind NOT NULL,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, name)
);

CREATE INDEX IF NOT EXISTS tenant_business_partners_tenant_kind_idx
  ON tenant_business_partners (tenant_id, kind, is_active);

ALTER TABLE site_suppliers
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES tenant_business_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS site_suppliers_partner_idx
  ON site_suppliers (partner_id)
  WHERE partner_id IS NOT NULL;

ALTER TABLE subcontractor_entries
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES tenant_business_partners(id) ON DELETE SET NULL;

ALTER TABLE delivery_notes
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES tenant_business_partners(id) ON DELETE SET NULL;

-- Bestehende Baustellen-Lieferanten in Stammdaten überführen
INSERT INTO tenant_business_partners (
  tenant_id,
  kind,
  name,
  contact_person,
  phone,
  email,
  notes
)
SELECT DISTINCT ON (ss.tenant_id, lower(trim(ss.name)))
  ss.tenant_id,
  'supplier'::business_partner_kind,
  trim(ss.name),
  ss.contact_person,
  ss.phone,
  ss.email,
  ss.notes
FROM site_suppliers ss
WHERE trim(ss.name) <> ''
ORDER BY ss.tenant_id, lower(trim(ss.name)), ss.created_at ASC
ON CONFLICT (tenant_id, kind, name) DO NOTHING;

UPDATE site_suppliers ss
SET partner_id = bp.id
FROM tenant_business_partners bp
WHERE bp.tenant_id = ss.tenant_id
  AND bp.kind = 'supplier'
  AND lower(bp.name) = lower(trim(ss.name))
  AND ss.partner_id IS NULL;

ALTER TABLE tenant_business_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_business_partners_select ON tenant_business_partners
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

CREATE POLICY tenant_business_partners_insert ON tenant_business_partners
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

CREATE POLICY tenant_business_partners_update ON tenant_business_partners
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

CREATE POLICY tenant_business_partners_delete ON tenant_business_partners
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

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, perm.key, true
FROM tenant_roles tr
CROSS JOIN (
  VALUES
    ('nav.partners'),
    ('partners.view'),
    ('partners.manage')
) AS perm(key)
WHERE tr.slug IN ('verwaltung', 'administrator')
   OR (tr.slug = 'vorarbeiter' AND perm.key IN ('nav.partners', 'partners.view'))
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
