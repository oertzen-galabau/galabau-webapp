-- Rapport-Umbau: benannte Mitarbeiterstunden, Mengen/Einheiten, Unterschriften

ALTER TABLE daily_log_work
  ADD COLUMN IF NOT EXISTS quantity numeric,
  ADD COLUMN IF NOT EXISTS unit text;

ALTER TABLE equipment_hours
  ADD COLUMN IF NOT EXISTS quantity numeric,
  ADD COLUMN IF NOT EXISTS unit text;

ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS dictation_transcript text,
  ADD COLUMN IF NOT EXISTS dictation_extraction jsonb;

CREATE TABLE IF NOT EXISTS daily_log_worker_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  daily_log_id uuid NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  worker_name text NOT NULL,
  job_title text,
  hours numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_log_worker_hours_log
  ON daily_log_worker_hours (daily_log_id);

CREATE INDEX IF NOT EXISTS idx_daily_log_worker_hours_tenant
  ON daily_log_worker_hours (tenant_id);

ALTER TABLE daily_log_worker_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_daily_log_worker_hours ON daily_log_worker_hours
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE TYPE daily_log_signature_role AS ENUM ('contractor', 'client');

CREATE TABLE IF NOT EXISTS daily_log_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  daily_log_id uuid NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  role daily_log_signature_role NOT NULL,
  signer_name text,
  file_url text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (daily_log_id, role)
);

CREATE INDEX IF NOT EXISTS idx_daily_log_signatures_log
  ON daily_log_signatures (daily_log_id);

CREATE INDEX IF NOT EXISTS idx_daily_log_signatures_tenant
  ON daily_log_signatures (tenant_id);

ALTER TABLE daily_log_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_daily_log_signatures ON daily_log_signatures
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
