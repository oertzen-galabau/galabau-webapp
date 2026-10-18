-- Optionale Buchungsnummer für Fahrzeuge & Geräte (Stammdaten)

ALTER TABLE tenant_equipment
  ADD COLUMN IF NOT EXISTS booking_number text;
