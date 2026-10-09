-- Kind-Tabellen: referenzierte Entitäten müssen zum gleichen Mandanten gehören

DROP POLICY IF EXISTS site_team_members_insert ON public.site_team_members;
CREATE POLICY site_team_members_insert ON public.site_team_members
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR EXISTS (
        SELECT 1
        FROM public.tenant_role_permissions trp
        JOIN public.profiles p ON p.tenant_role_id = trp.tenant_role_id
        WHERE p.id = auth.uid()
          AND trp.permission_key = 'sites.assign_team'
          AND trp.granted = true
      )
    )
    AND EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_team_members.site_id
        AND s.tenant_id = site_team_members.tenant_id
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = site_team_members.user_id
        AND p.tenant_id = site_team_members.tenant_id
    )
  );

DROP POLICY IF EXISTS catalog_order_items_insert ON public.catalog_order_items;
CREATE POLICY catalog_order_items_insert ON public.catalog_order_items
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.catalog_orders o
      WHERE o.id = catalog_order_items.order_id
        AND o.tenant_id = catalog_order_items.tenant_id
        AND o.user_id = auth.uid()
        AND o.status = 'pending'::clothing_status
    )
  );

DROP POLICY IF EXISTS tenant_isolation_delivery_items ON public.delivery_note_items;
CREATE POLICY tenant_isolation_delivery_items ON public.delivery_note_items
  FOR ALL
  USING (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.delivery_notes dn
      WHERE dn.id = delivery_note_items.delivery_note_id
        AND dn.tenant_id = delivery_note_items.tenant_id
    )
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.delivery_notes dn
      WHERE dn.id = delivery_note_items.delivery_note_id
        AND dn.tenant_id = delivery_note_items.tenant_id
    )
  );
