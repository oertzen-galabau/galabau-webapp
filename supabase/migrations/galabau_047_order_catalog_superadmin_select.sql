-- Superadmin: Katalog lesen (wie tenant_roles), App filtert weiter per tenant_id

DROP POLICY IF EXISTS order_catalog_categories_select ON order_catalog_categories;
CREATE POLICY order_catalog_categories_select ON order_catalog_categories
  FOR SELECT
  USING (tenant_id = current_tenant_id() OR is_superadmin());

DROP POLICY IF EXISTS order_catalog_items_select ON order_catalog_items;
CREATE POLICY order_catalog_items_select ON order_catalog_items
  FOR SELECT
  USING (tenant_id = current_tenant_id() OR is_superadmin());
