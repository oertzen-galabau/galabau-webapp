-- Tagesbericht vs. Stundenlohn-Rapport + optionaler Titel pro Eintrag

CREATE TYPE daily_log_report_type AS ENUM ('daily_report', 'hourly_wage_rapport');

ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS report_type daily_log_report_type NOT NULL DEFAULT 'hourly_wage_rapport',
  ADD COLUMN IF NOT EXISTS custom_title text;

UPDATE daily_logs SET report_type = 'hourly_wage_rapport' WHERE report_type IS NULL;

ALTER TABLE daily_logs DROP CONSTRAINT IF EXISTS daily_logs_tenant_id_site_id_log_date_key;

ALTER TABLE daily_logs
  ADD CONSTRAINT daily_logs_tenant_site_date_type_key
  UNIQUE (tenant_id, site_id, log_date, report_type);
