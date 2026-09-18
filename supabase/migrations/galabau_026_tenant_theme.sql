-- Erweiterte Mandanten-Farben für Seitenleiste und Arbeitsfläche
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS sidebar_color text NOT NULL DEFAULT '#202b33',
  ADD COLUMN IF NOT EXISTS sidebar_text_color text NOT NULL DEFAULT '#fff9ef',
  ADD COLUMN IF NOT EXISTS surface_color text NOT NULL DEFAULT '#eeeae3';
