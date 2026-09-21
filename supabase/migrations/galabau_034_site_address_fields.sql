-- Baustellen-Adresse in Straße, PLZ und Ort aufteilen
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS city text;

-- Bestehende Adressen mit PLZ-Muster aufteilen (z.B. "Musterstraße 1, 12345 Berlin")
UPDATE sites
SET
  zip_code = (regexp_match(trim(address), '(\d{5})'))[1],
  city = trim((regexp_match(trim(address), '\d{5}\s+(.+)$'))[1]),
  street = trim(regexp_replace(trim(address), ',?\s*\d{5}\s+.+$', ''))
WHERE address IS NOT NULL
  AND trim(address) <> ''
  AND trim(address) ~ '\d{5}\s+.+'
  AND street IS NULL;

-- Übrige Adressen vollständig in Straße übernehmen
UPDATE sites
SET street = trim(address)
WHERE address IS NOT NULL
  AND trim(address) <> ''
  AND street IS NULL;

-- Kombinierte Adresse aus den neuen Feldern aktualisieren
UPDATE sites
SET address = trim(both ', ' from concat_ws(', ',
  NULLIF(trim(street), ''),
  NULLIF(trim(concat_ws(' ', NULLIF(trim(zip_code), ''), NULLIF(trim(city), ''))), '')
))
WHERE street IS NOT NULL
   OR zip_code IS NOT NULL
   OR city IS NOT NULL;
