-- Soft-Delete für Untereinträge der Tagesdokumentation

ALTER TABLE delivery_notes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE subcontractor_entries
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE daily_log_photos
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
