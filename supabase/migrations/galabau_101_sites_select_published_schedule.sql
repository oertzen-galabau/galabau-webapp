-- Einsatzplan: Mitarbeiter sehen Baustellenname/Adresse nur, wenn sites per RLS lesbar sind.
-- Der Join schedule_entries → sites schlägt sonst fehl (UI zeigt „—“).

DROP POLICY IF EXISTS sites_select ON sites;

CREATE POLICY sites_select ON sites
  FOR SELECT
  USING (
    (tenant_id = current_tenant_id() OR is_superadmin())
    AND (
      is_superadmin()
      OR has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('sites.assign_team')
      OR responsible_user_id = auth.uid()
      OR site_manager_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM site_team_members stm
        WHERE stm.site_id = sites.id
          AND stm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM schedule_entries se
        WHERE se.site_id = sites.id
          AND se.tenant_id = sites.tenant_id
          AND public.schedule_day_is_published(se.tenant_id, se.start_date)
      )
    )
  );
