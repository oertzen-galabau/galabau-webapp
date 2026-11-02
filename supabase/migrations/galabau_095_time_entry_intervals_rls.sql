-- RLS wie übrige Mandanten-Tabellen: current_tenant_id() (Superadmin + x-tenant-slug)

DROP POLICY IF EXISTS tenant_isolation_time_entry_intervals ON time_entry_intervals;
CREATE POLICY tenant_isolation_time_entry_intervals ON time_entry_intervals
  FOR ALL
  USING (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM time_entries te
      WHERE te.id = time_entry_intervals.time_entry_id
        AND te.tenant_id = current_tenant_id()
        AND (
          te.user_id = auth.uid()
          OR has_tenant_permission('zeiten.approve'::text)
        )
    )
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM time_entries te
      WHERE te.id = time_entry_intervals.time_entry_id
        AND te.tenant_id = current_tenant_id()
        AND (
          te.user_id = auth.uid()
          OR has_tenant_permission('zeiten.approve'::text)
        )
    )
  );
