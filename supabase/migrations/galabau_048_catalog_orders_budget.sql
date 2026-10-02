-- Katalog-Bestellungen (Warenkorb) + Jahresbudget

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS default_clothing_order_budget_eur numeric(10, 2);

CREATE TABLE IF NOT EXISTS clothing_order_budgets (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year int NOT NULL,
  budget_eur numeric(10, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, year),
  CONSTRAINT clothing_order_budgets_year_check CHECK (year >= 2000 AND year <= 2100),
  CONSTRAINT clothing_order_budgets_budget_nonneg CHECK (budget_eur >= 0)
);

CREATE TABLE IF NOT EXISTS catalog_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status clothing_status NOT NULL DEFAULT 'pending',
  total_eur numeric(10, 2) NOT NULL DEFAULT 0,
  budget_covered_eur numeric(10, 2) NOT NULL DEFAULT 0,
  own_share_eur numeric(10, 2) NOT NULL DEFAULT 0,
  budget_year int NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_orders_tenant_user_idx
  ON catalog_orders (tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS catalog_orders_tenant_year_idx
  ON catalog_orders (tenant_id, user_id, budget_year);

CREATE TABLE IF NOT EXISTS catalog_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES catalog_orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  catalog_item_id uuid NOT NULL REFERENCES order_catalog_items(id) ON DELETE RESTRICT,
  category_name text NOT NULL,
  article_number text,
  clothing_style text NOT NULL,
  series text,
  unit_price_eur numeric(10, 2),
  size text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  name_print text,
  line_total_eur numeric(10, 2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  CONSTRAINT catalog_order_items_quantity_check CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS catalog_order_items_order_idx ON catalog_order_items (order_id);

ALTER TABLE clothing_order_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_order_items ENABLE ROW LEVEL SECURITY;

-- Budget lesen: eigenes Budget oder Verwaltung
CREATE POLICY clothing_order_budgets_select ON clothing_order_budgets
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      user_id = auth.uid()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'orders.manage_budget'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY clothing_order_budgets_insert ON clothing_order_budgets
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'orders.manage_budget'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY clothing_order_budgets_update ON clothing_order_budgets
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'orders.manage_budget'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY catalog_orders_select ON catalog_orders
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      user_id = auth.uid()
      OR is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'orders.manage'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY catalog_orders_insert ON catalog_orders
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND user_id = auth.uid()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role, 'vorarbeiter'::user_role, 'mitarbeiter'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'orders.create'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY catalog_orders_update ON catalog_orders
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1 FROM tenant_role_permissions trp
        JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'orders.manage'
          AND trp.granted = true
      )
    )
  );

CREATE POLICY catalog_orders_delete ON catalog_orders
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND user_id = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY catalog_order_items_select ON catalog_order_items
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM catalog_orders o
      WHERE o.id = catalog_order_items.order_id
        AND (
          o.user_id = auth.uid()
          OR is_superadmin()
          OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
          OR EXISTS (
            SELECT 1 FROM tenant_role_permissions trp
            JOIN profiles p ON p.tenant_role_id = trp.tenant_role_id
            WHERE p.id = auth.uid()
              AND trp.permission_key = 'orders.manage'
              AND trp.granted = true
          )
        )
    )
  );

CREATE POLICY catalog_order_items_insert ON catalog_order_items
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM catalog_orders o
      WHERE o.id = catalog_order_items.order_id
        AND o.user_id = auth.uid()
        AND o.status = 'pending'
    )
  );

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, perm.key, true
FROM tenant_roles tr
CROSS JOIN (VALUES ('orders.manage'), ('orders.manage_budget')) AS perm(key)
WHERE tr.slug IN ('verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
