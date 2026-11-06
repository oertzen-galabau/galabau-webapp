-- Zusätzliche Fälligkeit „Inspektion“ (allgemein), getrennt von HU/TÜV (inspection_due_date) und UVV.
ALTER TABLE tenant_equipment
  ADD COLUMN IF NOT EXISTS general_inspection_due_date date;

COMMENT ON COLUMN tenant_equipment.general_inspection_due_date IS
  'Allgemeine Inspektion (Kalender), UI: Inspektion; getrennt von HU/TÜV und UVV.';
