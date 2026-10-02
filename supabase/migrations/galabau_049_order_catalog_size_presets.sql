-- Mandanten-Größenlisten (Kleidung / Schuhe) + Kategorie-Zuordnung

ALTER TABLE order_catalog_categories
  ADD COLUMN IF NOT EXISTS size_kind text NOT NULL DEFAULT 'clothing'
  CHECK (size_kind IN ('clothing', 'shoes', 'custom'));

CREATE TABLE IF NOT EXISTS order_catalog_size_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('clothing', 'shoes')),
  value text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kind, value)
);

CREATE INDEX IF NOT EXISTS order_catalog_size_options_tenant_kind_idx
  ON order_catalog_size_options (tenant_id, kind, sort_order);

ALTER TABLE order_catalog_size_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_catalog_size_options_select ON order_catalog_size_options
  FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY order_catalog_size_options_insert ON order_catalog_size_options
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'orders.manage_catalog'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY order_catalog_size_options_update ON order_catalog_size_options
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'orders.manage_catalog'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY order_catalog_size_options_delete ON order_catalog_size_options
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'orders.manage_catalog'
          AND trp.granted = true
      )
    )
  );

-- Schuh-Kategorien erkennen
UPDATE order_catalog_categories
SET size_kind = 'shoes'
WHERE size_kind = 'clothing'
  AND (
    lower(name) LIKE '%schuh%'
    OR lower(name) LIKE '%stiefel%'
  );

-- Standard-Größen für bestehende Mandanten
INSERT INTO order_catalog_size_options (tenant_id, kind, value, sort_order)
SELECT t.id, 'clothing', v.value, v.ord
FROM tenants t
CROSS JOIN (
  VALUES
    ('XS', 10), ('S', 20), ('M', 30), ('L', 40), ('XL', 50), ('XXL', 60),
    ('3XL', 70), ('4XL', 80), ('5XL', 90)
) AS v(value, ord)
ON CONFLICT (tenant_id, kind, value) DO NOTHING;

INSERT INTO order_catalog_size_options (tenant_id, kind, value, sort_order)
SELECT t.id, 'shoes', v.value, v.ord
FROM tenants t
CROSS JOIN (
  VALUES
    ('37', 10), ('38', 20), ('39', 30), ('40', 40), ('41', 50), ('42', 60),
    ('43', 70), ('44', 80), ('45', 90), ('46', 100), ('47', 110), ('48', 120)
) AS v(value, ord)
ON CONFLICT (tenant_id, kind, value) DO NOTHING;
