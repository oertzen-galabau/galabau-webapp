-- Lieferscheine: Metadaten + Positionsliste + KI-Extraktionsstatus

CREATE TYPE delivery_note_extraction_status AS ENUM ('pending', 'success', 'failed', 'manual');

ALTER TABLE delivery_notes
  ADD COLUMN IF NOT EXISTS delivery_note_number text,
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS extraction_status delivery_note_extraction_status NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS raw_extraction jsonb;

CREATE TABLE IF NOT EXISTS delivery_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  delivery_note_id uuid NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  description text NOT NULL,
  quantity numeric,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_note_items_note
  ON delivery_note_items (delivery_note_id, position);

CREATE INDEX IF NOT EXISTS idx_delivery_note_items_tenant
  ON delivery_note_items (tenant_id);

ALTER TABLE delivery_note_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_delivery_items ON delivery_note_items
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
