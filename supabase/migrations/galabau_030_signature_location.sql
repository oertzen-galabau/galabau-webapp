-- Unterschrift: Standort und Zeitpunkt der Erfassung
ALTER TABLE daily_log_signatures
  ADD COLUMN IF NOT EXISTS signed_latitude double precision,
  ADD COLUMN IF NOT EXISTS signed_longitude double precision,
  ADD COLUMN IF NOT EXISTS signed_location_label text;

COMMENT ON COLUMN daily_log_signatures.signed_at IS 'Zeitpunkt der Unterschrift (clientseitig beim Zeichnen erfasst)';
COMMENT ON COLUMN daily_log_signatures.signed_latitude IS 'Breitengrad beim Unterschreiben';
COMMENT ON COLUMN daily_log_signatures.signed_longitude IS 'Längengrad beim Unterschreiben';
COMMENT ON COLUMN daily_log_signatures.signed_location_label IS 'Lesbarer Standort (Reverse-Geocoding)';
