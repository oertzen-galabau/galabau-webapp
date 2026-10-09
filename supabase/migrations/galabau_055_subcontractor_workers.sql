-- Subunternehmer: mehrere Personen pro Firma (Gruppe)

ALTER TABLE public.subcontractor_entries
  ADD COLUMN IF NOT EXISTS worker_name text,
  ADD COLUMN IF NOT EXISTS group_key uuid;

COMMENT ON COLUMN public.subcontractor_entries.worker_name IS
  'Name der Person beim Subunternehmer (Tagesrapport); leer = nur Gesamtstunden der Zeile.';

COMMENT ON COLUMN public.subcontractor_entries.group_key IS
  'Gemeinsame UUID für alle Personenzeilen eines Subunternehmers am selben Tageseintrag.';

UPDATE public.subcontractor_entries
SET group_key = id
WHERE group_key IS NULL;
