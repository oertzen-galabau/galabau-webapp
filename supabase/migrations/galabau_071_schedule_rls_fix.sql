-- Einsatzplanung: RLS an App-Rollen anbinden (Slug + Superadmin), fehlende Matrix-Keys abfedern

CREATE OR REPLACE FUNCTION public.user_can_schedule_manage()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superadmin()
    OR public.has_tenant_permission('schedule.manage')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.tenant_roles tr ON tr.id = p.tenant_role_id
      WHERE p.id = auth.uid()
        AND tr.slug IN ('vorarbeiter', 'verwaltung', 'administrator')
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_schedule_publish()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superadmin()
    OR public.has_tenant_permission('schedule.publish')
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.tenant_roles tr ON tr.id = p.tenant_role_id
      WHERE p.id = auth.uid()
        AND tr.slug IN ('vorarbeiter', 'verwaltung', 'administrator')
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_schedule_view()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_superadmin()
    OR public.has_tenant_permission('schedule.view')
    OR public.user_can_schedule_manage()
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.tenant_id = public.current_tenant_id()
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_schedule_manage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_schedule_publish() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_schedule_view() TO authenticated;

DROP POLICY IF EXISTS schedule_entries_select ON schedule_entries;
DROP POLICY IF EXISTS schedule_entries_insert ON schedule_entries;
DROP POLICY IF EXISTS schedule_entries_update ON schedule_entries;
DROP POLICY IF EXISTS schedule_entries_delete ON schedule_entries;

CREATE POLICY schedule_entries_select ON schedule_entries
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.user_can_schedule_manage()
      OR public.schedule_week_is_published(
        tenant_id,
        public.schedule_entry_week_start(start_date)
      )
    )
  );

CREATE POLICY schedule_entries_insert ON schedule_entries
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_manage()
  );

CREATE POLICY schedule_entries_update ON schedule_entries
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_manage()
  )
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY schedule_entries_delete ON schedule_entries
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_manage()
  );

DROP POLICY IF EXISTS schedule_entry_members_select ON schedule_entry_members;
DROP POLICY IF EXISTS schedule_entry_members_insert ON schedule_entry_members;
DROP POLICY IF EXISTS schedule_entry_members_delete ON schedule_entry_members;

CREATE POLICY schedule_entry_members_select ON schedule_entry_members
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.user_can_schedule_manage()
      OR EXISTS (
        SELECT 1 FROM schedule_entries se
        WHERE se.id = schedule_entry_members.schedule_entry_id
          AND public.schedule_week_is_published(
            se.tenant_id,
            public.schedule_entry_week_start(se.start_date)
          )
      )
    )
  );

CREATE POLICY schedule_entry_members_insert ON schedule_entry_members
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_manage()
  );

CREATE POLICY schedule_entry_members_delete ON schedule_entry_members
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_manage()
  );

DROP POLICY IF EXISTS schedule_week_publications_select ON schedule_week_publications;
DROP POLICY IF EXISTS schedule_week_publications_insert ON schedule_week_publications;
DROP POLICY IF EXISTS schedule_week_publications_delete ON schedule_week_publications;

CREATE POLICY schedule_week_publications_select ON schedule_week_publications
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_view()
  );

CREATE POLICY schedule_week_publications_insert ON schedule_week_publications
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_publish()
  );

CREATE POLICY schedule_week_publications_update ON schedule_week_publications
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_publish()
  )
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY schedule_week_publications_delete ON schedule_week_publications
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.user_can_schedule_publish()
      OR public.user_can_schedule_manage()
    )
  );

-- Permission-Keys in der Matrix nachziehen (alle Mandanten)
INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, perm.key, true
FROM tenant_roles tr
CROSS JOIN (VALUES
  ('nav.einsatzplanung'),
  ('schedule.view')
) AS perm(key)
WHERE tr.slug = 'mitarbeiter'
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, perm.key, true
FROM tenant_roles tr
CROSS JOIN (VALUES
  ('nav.einsatzplanung'),
  ('schedule.view'),
  ('schedule.manage'),
  ('schedule.publish'),
  ('schedule.share')
) AS perm(key)
WHERE tr.slug IN ('vorarbeiter', 'verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
