-- Upsert beim (Nach-)Veröffentlichen eines Tages braucht UPDATE (galabau_073 hatte nur INSERT/DELETE).

DROP POLICY IF EXISTS schedule_day_publications_update ON schedule_day_publications;

CREATE POLICY schedule_day_publications_update ON schedule_day_publications
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_publish()
  )
  WITH CHECK (tenant_id = current_tenant_id());
