ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS driver_trip text NOT NULL DEFAULT 'none';

ALTER TABLE time_entries
  DROP CONSTRAINT IF EXISTS time_entries_driver_trip_check;

ALTER TABLE time_entries
  ADD CONSTRAINT time_entries_driver_trip_check
  CHECK (driver_trip IN ('none', 'round_trip', 'outbound', 'return'));

UPDATE time_entries
SET driver_trip = 'round_trip'
WHERE is_driver IS TRUE;
