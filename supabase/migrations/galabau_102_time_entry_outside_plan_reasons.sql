ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS planned_end_time time,
  ADD COLUMN IF NOT EXISTS late_start_reason text,
  ADD COLUMN IF NOT EXISTS late_end_reason text;