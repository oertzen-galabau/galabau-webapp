CREATE UNIQUE INDEX IF NOT EXISTS time_entries_user_work_date_key
  ON time_entries (user_id, work_date);