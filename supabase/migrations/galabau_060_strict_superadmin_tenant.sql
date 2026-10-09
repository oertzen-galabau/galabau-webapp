-- Strikter Superadmin: nur geöffneter Mandant (current_tenant_id), keine mandantenübergreifenden SELECTs

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()),
    CASE
      WHEN public.is_superadmin() THEN (
        SELECT t.id
        FROM public.tenants t
        WHERE t.slug = (
          SELECT nullif(
            trim(both '"' from coalesce(
              current_setting('request.headers', true)::json->>'x-tenant-slug',
              current_setting('request.headers', true)::json->>'X-Tenant-Slug'
            )),
            ''
          )
        )
        LIMIT 1
      )
      ELSE NULL::uuid
    END
  );
$$;

-- profiles SELECT
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR tenant_id = current_tenant_id()
  );

DROP POLICY IF EXISTS profiles_insert_admin ON public.profiles;
CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
    AND role IS DISTINCT FROM 'superadmin'::user_role
  );

DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
  )
  WITH CHECK (tenant_id = current_tenant_id());

-- sites (052)
DROP POLICY IF EXISTS sites_select ON public.sites;
CREATE POLICY sites_select ON public.sites
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.assign_team'::text)
      OR responsible_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.site_team_members stm
        WHERE stm.site_id = sites.id AND stm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS sites_insert ON public.sites;
CREATE POLICY sites_insert ON public.sites
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.manage'::text)
    )
  );

DROP POLICY IF EXISTS sites_update ON public.sites;
CREATE POLICY sites_update ON public.sites
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.manage'::text)
    )
  )
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS sites_delete ON public.sites;
CREATE POLICY sites_delete ON public.sites
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.manage'::text)
    )
  );

-- employee_notes
DROP POLICY IF EXISTS employee_notes_select ON public.employee_notes;
CREATE POLICY employee_notes_select ON public.employee_notes
  FOR SELECT
  USING (tenant_id = current_tenant_id());

-- order catalog (047)
DROP POLICY IF EXISTS order_catalog_categories_select ON public.order_catalog_categories;
CREATE POLICY order_catalog_categories_select ON public.order_catalog_categories
  FOR SELECT
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS order_catalog_items_select ON public.order_catalog_items;
CREATE POLICY order_catalog_items_select ON public.order_catalog_items
  FOR SELECT
  USING (tenant_id = current_tenant_id());

-- catalog_orders
DROP POLICY IF EXISTS catalog_orders_select ON public.catalog_orders;
CREATE POLICY catalog_orders_select ON public.catalog_orders
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      user_id = auth.uid()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1
        FROM public.tenant_role_permissions trp
        JOIN public.profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'orders.manage'
          AND trp.granted = true
      )
    )
  );

-- tenant_roles / permissions
DROP POLICY IF EXISTS tenant_roles_select ON public.tenant_roles;
CREATE POLICY tenant_roles_select ON public.tenant_roles
  FOR SELECT
  USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_roles_modify ON public.tenant_roles;
CREATE POLICY tenant_roles_modify ON public.tenant_roles
  FOR ALL
  USING (
    tenant_id = current_tenant_id()
    AND has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
  );

DROP POLICY IF EXISTS tenant_role_permissions_select ON public.tenant_role_permissions;
CREATE POLICY tenant_role_permissions_select ON public.tenant_role_permissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_roles tr
      WHERE tr.id = tenant_role_permissions.tenant_role_id
        AND tr.tenant_id = current_tenant_id()
    )
  );

DROP POLICY IF EXISTS tenant_role_permissions_modify ON public.tenant_role_permissions;
CREATE POLICY tenant_role_permissions_modify ON public.tenant_role_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_roles tr
      WHERE tr.id = tenant_role_permissions.tenant_role_id
        AND tr.tenant_id = current_tenant_id()
        AND has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_roles tr
      WHERE tr.id = tenant_role_permissions.tenant_role_id
        AND tr.tenant_id = current_tenant_id()
        AND has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
    )
  );
