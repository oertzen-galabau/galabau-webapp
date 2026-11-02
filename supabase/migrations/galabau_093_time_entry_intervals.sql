-- Live-Zeiterfassung: Intervalle (Arbeit/Pause), Einsatzplan-Abgleich

CREATE TYPE time_entry_interval_phase AS ENUM ('work', 'pause');

CREATE TABLE IF NOT EXISTS time_entry_intervals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  time_entry_id uuid NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  phase time_entry_interval_phase NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  suggested_block_type time_entry_block_type,
  confirmed_block_type time_entry_block_type,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_entry_intervals_entry
  ON time_entry_intervals (time_entry_id, sort_order);

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS early_start_reason text,
  ADD COLUMN IF NOT EXISTS planned_start_time time,
  ADD COLUMN IF NOT EXISTS schedule_entry_id uuid REFERENCES schedule_entries(id) ON DELETE SET NULL;

ALTER TABLE tenant_time_tracking_rules
  ADD COLUMN IF NOT EXISTS compare_schedule_on_clock_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS early_start_tolerance_minutes integer NOT NULL DEFAULT 5;

ALTER TABLE time_entry_intervals ENABLE ROW LEVEL SECURITY;

-- RLS final in galabau_095_time_entry_intervals_rls.sql (current_tenant_id)
