-- Einsatzplanung: Tageseinsätze (start_date = end_date), Veröffentlichung pro Tag

-- Mehrtages-Einsätze in Einzeltage aufteilen (Mitglieder + Geräte mitkopieren)
DO $$
DECLARE
  r RECORD;
  d date;
  new_id uuid;
BEGIN
  FOR r IN
    SELECT id, tenant_id, site_id, start_date, end_date, start_time, end_time,
           foreman_user_id, external_workers_text, notes, sort_order, created_by
    FROM schedule_entries
    WHERE end_date > start_date
    ORDER BY start_date, id
  LOOP
    UPDATE schedule_entries
    SET end_date = r.start_date, updated_at = now()
    WHERE id = r.id;

    d := r.start_date + 1;
    WHILE d <= r.end_date LOOP
      INSERT INTO schedule_entries (
        tenant_id, site_id, start_date, end_date, start_time, end_time,
        foreman_user_id, external_workers_text, notes, sort_order, created_by
      ) VALUES (
        r.tenant_id, r.site_id, d, d, r.start_time, r.end_time,
        r.foreman_user_id, r.external_workers_text, r.notes, r.sort_order, r.created_by
      )
      RETURNING id INTO new_id;

      INSERT INTO schedule_entry_members (tenant_id, schedule_entry_id, user_id)
      SELECT tenant_id, new_id, user_id
      FROM schedule_entry_members
      WHERE schedule_entry_id = r.id;

      INSERT INTO schedule_entry_equipment (tenant_id, schedule_entry_id, equipment_id)
      SELECT tenant_id, new_id, equipment_id
      FROM schedule_entry_equipment
      WHERE schedule_entry_id = r.id;

      d := d + 1;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE schedule_entries
  DROP CONSTRAINT IF EXISTS schedule_entries_date_range;

ALTER TABLE schedule_entries
  ADD CONSTRAINT schedule_entries_single_day CHECK (start_date = end_date);

CREATE UNIQUE INDEX IF NOT EXISTS schedule_entries_tenant_site_day_uidx
  ON schedule_entries (tenant_id, site_id, start_date);

CREATE TABLE IF NOT EXISTS schedule_day_publications (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (tenant_id, plan_date)
);

CREATE OR REPLACE FUNCTION public.schedule_day_is_published(p_tenant_id uuid, p_plan_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.schedule_day_publications sdp
    WHERE sdp.tenant_id = p_tenant_id
      AND sdp.plan_date = p_plan_date
  );
$$;

GRANT EXECUTE ON FUNCTION public.schedule_day_is_published(uuid, date) TO authenticated;

-- Wochen-Veröffentlichungen auf alle 7 Tage übertragen
INSERT INTO schedule_day_publications (tenant_id, plan_date, published_at, published_by)
SELECT
  swp.tenant_id,
  (swp.week_start + offs.i)::date,
  swp.published_at,
  swp.published_by
FROM schedule_week_publications swp
CROSS JOIN generate_series(0, 6) AS offs(i)
ON CONFLICT (tenant_id, plan_date) DO NOTHING;

-- RLS: Lesen nur bei Manage oder veröffentlichtem Tag
DROP POLICY IF EXISTS schedule_entries_select ON schedule_entries;
CREATE POLICY schedule_entries_select ON schedule_entries
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.user_can_schedule_manage()
      OR public.schedule_day_is_published(tenant_id, start_date)
    )
  );

DROP POLICY IF EXISTS schedule_entry_members_select ON schedule_entry_members;
CREATE POLICY schedule_entry_members_select ON schedule_entry_members
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.user_can_schedule_manage()
      OR EXISTS (
        SELECT 1 FROM schedule_entries se
        WHERE se.id = schedule_entry_members.schedule_entry_id
          AND public.schedule_day_is_published(se.tenant_id, se.start_date)
      )
    )
  );

DROP POLICY IF EXISTS schedule_entry_equipment_select ON schedule_entry_equipment;
CREATE POLICY schedule_entry_equipment_select ON schedule_entry_equipment
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.user_can_schedule_manage()
      OR EXISTS (
        SELECT 1 FROM schedule_entries se
        WHERE se.id = schedule_entry_equipment.schedule_entry_id
          AND public.schedule_day_is_published(se.tenant_id, se.start_date)
      )
    )
  );

ALTER TABLE schedule_day_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedule_day_publications_select ON schedule_day_publications
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_view()
  );

CREATE POLICY schedule_day_publications_insert ON schedule_day_publications
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND public.user_can_schedule_publish()
  );

CREATE POLICY schedule_day_publications_delete ON schedule_day_publications
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      public.user_can_schedule_publish()
      OR public.user_can_schedule_manage()
    )
  );
