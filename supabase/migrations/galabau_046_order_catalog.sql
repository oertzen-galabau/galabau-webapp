-- Bestellkatalog pro Mandant (Kategorien + Artikel)

CREATE TABLE IF NOT EXISTS order_catalog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS order_catalog_categories_tenant_idx
  ON order_catalog_categories (tenant_id, sort_order);

CREATE TABLE IF NOT EXISTS order_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES order_catalog_categories(id) ON DELETE RESTRICT,
  article_number text,
  clothing_style text NOT NULL DEFAULT '',
  series text,
  price numeric(10, 2),
  shop_url text,
  sizes text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  shop_imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_catalog_items_tenant_idx
  ON order_catalog_items (tenant_id, is_active);

CREATE INDEX IF NOT EXISTS order_catalog_items_category_idx
  ON order_catalog_items (category_id);

ALTER TABLE order_catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY order_catalog_categories_select ON order_catalog_categories
  FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY order_catalog_categories_insert ON order_catalog_categories
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

CREATE POLICY order_catalog_categories_update ON order_catalog_categories
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

CREATE POLICY order_catalog_categories_delete ON order_catalog_categories
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

CREATE POLICY order_catalog_items_select ON order_catalog_items
  FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY order_catalog_items_insert ON order_catalog_items
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

CREATE POLICY order_catalog_items_update ON order_catalog_items
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

CREATE POLICY order_catalog_items_delete ON order_catalog_items
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

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'orders.manage_catalog', true
FROM tenant_roles tr
WHERE tr.slug IN ('verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
