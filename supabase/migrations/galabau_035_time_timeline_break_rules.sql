-- Tageszeitleiste: Blocktypen, Pausengründe, Mandantenregeln

CREATE TYPE time_entry_block_type AS ENUM (
  'site_work',
  'travel',
  'breakfast',
  'lunch',
  'other_work'
);

ALTER TABLE time_entry_segments
  ADD COLUMN IF NOT EXISTS block_type time_entry_block_type NOT NULL DEFAULT 'site_work';

ALTER TABLE time_entry_segments
  ALTER COLUMN site_id DROP NOT NULL;

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS missing_breakfast_reason text,
  ADD COLUMN IF NOT EXISTS missing_lunch_reason text;

CREATE TABLE IF NOT EXISTS tenant_time_tracking_rules (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  breakfast_enabled boolean NOT NULL DEFAULT true,
  breakfast_min_work_minutes integer NOT NULL DEFAULT 240,
  breakfast_expected_minutes integer NOT NULL DEFAULT 15,
  breakfast_window_start time NOT NULL DEFAULT '08:00',
  breakfast_window_end time NOT NULL DEFAULT '10:30',
  lunch_enabled boolean NOT NULL DEFAULT true,
  lunch_min_work_minutes integer NOT NULL DEFAULT 361,
  lunch_expected_minutes integer NOT NULL DEFAULT 30,
  lunch_window_start time NOT NULL DEFAULT '11:00',
  lunch_window_end time NOT NULL DEFAULT '14:30',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO tenant_time_tracking_rules (tenant_id)
SELECT t.id FROM tenants t
ON CONFLICT (tenant_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_time_entry_segments_site_approved
  ON time_entry_segments (site_id, tenant_id)
  WHERE site_id IS NOT NULL;

ALTER TABLE time_entry_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_time_tracking_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_time_entry_segments ON time_entry_segments;
CREATE POLICY tenant_isolation_time_entry_segments ON time_entry_segments
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS tenant_isolation_time_tracking_rules ON tenant_time_tracking_rules;
CREATE POLICY tenant_isolation_time_tracking_rules ON tenant_time_tracking_rules
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM profiles WHERE id = auth.uid()
    )
  );

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'settings.time_tracking', true
FROM tenant_roles tr
WHERE tr.slug IN ('verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO NOTHING;
