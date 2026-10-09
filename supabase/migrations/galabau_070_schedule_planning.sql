-- Einsatzplanung: Einsätze, Mitglieder, Wochen-Veröffentlichung, Bauleiter-Kürzel

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS leader_code text;

COMMENT ON COLUMN profiles.leader_code IS 'Kürzel für Einsatzplan/PDF (z.B. LG, MS). Fallback: Initialen.';

CREATE TABLE IF NOT EXISTS schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time NOT NULL DEFAULT '07:00',
  end_time time NOT NULL DEFAULT '16:00',
  foreman_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  external_workers_text text,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_entries_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS schedule_entries_tenant_dates_idx
  ON schedule_entries (tenant_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS schedule_entries_site_idx
  ON schedule_entries (site_id);

CREATE TABLE IF NOT EXISTS schedule_entry_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  schedule_entry_id uuid NOT NULL REFERENCES schedule_entries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_entry_id, user_id)
);

CREATE INDEX IF NOT EXISTS schedule_entry_members_user_idx
  ON schedule_entry_members (tenant_id, user_id);

CREATE TABLE IF NOT EXISTS schedule_week_publications (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (tenant_id, week_start)
);

CREATE OR REPLACE FUNCTION public.schedule_entry_week_start(p_start_date date)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_start_date - ((EXTRACT(ISODOW FROM p_start_date)::int + 6) % 7))::date;
$$;

CREATE OR REPLACE FUNCTION public.schedule_week_is_published(p_tenant_id uuid, p_week_start date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.schedule_week_publications swp
    WHERE swp.tenant_id = p_tenant_id
      AND swp.week_start = p_week_start
  );
$$;

ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entry_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_week_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedule_entries_select ON schedule_entries
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.has_tenant_permission('schedule.manage')
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
    AND public.has_tenant_permission('schedule.manage')
  );

CREATE POLICY schedule_entries_update ON schedule_entries
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND public.has_tenant_permission('schedule.manage')
  );

CREATE POLICY schedule_entries_delete ON schedule_entries
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND public.has_tenant_permission('schedule.manage')
  );

CREATE POLICY schedule_entry_members_select ON schedule_entry_members
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.has_tenant_permission('schedule.manage')
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
    AND public.has_tenant_permission('schedule.manage')
  );

CREATE POLICY schedule_entry_members_delete ON schedule_entry_members
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND public.has_tenant_permission('schedule.manage')
  );

CREATE POLICY schedule_week_publications_select ON schedule_week_publications
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.has_tenant_permission('schedule.view')
      OR public.has_tenant_permission('schedule.manage')
    )
  );

CREATE POLICY schedule_week_publications_insert ON schedule_week_publications
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND public.has_tenant_permission('schedule.publish')
  );

CREATE POLICY schedule_week_publications_delete ON schedule_week_publications
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.has_tenant_permission('schedule.publish')
      OR public.has_tenant_permission('schedule.manage')
    )
  );

GRANT EXECUTE ON FUNCTION public.schedule_entry_week_start(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_week_is_published(uuid, date) TO authenticated;

-- Permissions für Systemrollen
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
