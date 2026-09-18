-- Geocoding-Koordinaten für Baustellen (Wetteranzeige via Open-Meteo)
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;
