-- Superadmin: Flotte/Geräte im geöffneten Mandanten lesen und pflegen (RLS-Lücke zu App-Berechtigungen)

DROP POLICY IF EXISTS tenant_equipment_select ON tenant_equipment;
CREATE POLICY tenant_equipment_select ON tenant_equipment
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

DROP POLICY IF EXISTS tenant_equipment_insert ON tenant_equipment;
CREATE POLICY tenant_equipment_insert ON tenant_equipment
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

DROP POLICY IF EXISTS tenant_equipment_update ON tenant_equipment;
CREATE POLICY tenant_equipment_update ON tenant_equipment
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
  );

DROP POLICY IF EXISTS tenant_equipment_delete ON tenant_equipment;
CREATE POLICY tenant_equipment_delete ON tenant_equipment
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
