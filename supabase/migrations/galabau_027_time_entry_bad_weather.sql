-- Schlechtwetter (KUG): Mitarbeiter-Meldung + Freigabe-Bestätigung pro Zeiteintrag
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS bad_weather_claimed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bad_weather_confirmed boolean;
