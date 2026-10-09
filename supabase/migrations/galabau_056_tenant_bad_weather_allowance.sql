-- Schlechtwetter-Kontingent pro Mandant (Urlaubskonto), Einstellungen > Allgemein

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS bad_weather_allowance_days integer NOT NULL DEFAULT 5;

COMMENT ON COLUMN public.tenants.bad_weather_allowance_days IS
  'Kontingent KUG-Schlechtwetter-Tage pro Kalenderjahr; nur genutzte Tage darüber mindern Resturlaub.';

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_bad_weather_allowance_days_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_bad_weather_allowance_days_check
  CHECK (bad_weather_allowance_days >= 0 AND bad_weather_allowance_days <= 366);
