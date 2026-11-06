-- Vorlagen für Ablehnungsgründe bei Zeiten-Freigabe (pro Mandant)

CREATE TABLE IF NOT EXISTS time_rejection_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  label text NOT NULL,
  body text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_rejection_templates_label_len CHECK (char_length(label) BETWEEN 1 AND 80),
  CONSTRAINT time_rejection_templates_body_len CHECK (char_length(body) BETWEEN 1 AND 2000),
  UNIQUE (tenant_id, label)
);

CREATE INDEX IF NOT EXISTS time_rejection_templates_tenant_sort_idx
  ON time_rejection_templates (tenant_id, sort_order, label);

ALTER TABLE time_rejection_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY time_rejection_templates_select ON time_rejection_templates
  FOR SELECT
  USING (
    tenant_id = current_tenant_id()
    AND has_tenant_permission('zeiten.approve'::text)
  );

CREATE POLICY time_rejection_templates_insert ON time_rejection_templates
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND has_tenant_permission('zeiten.approve'::text)
  );

CREATE POLICY time_rejection_templates_update ON time_rejection_templates
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND has_tenant_permission('zeiten.approve'::text)
  )
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND has_tenant_permission('zeiten.approve'::text)
  );

CREATE POLICY time_rejection_templates_delete ON time_rejection_templates
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND has_tenant_permission('zeiten.approve'::text)
  );

COMMENT ON TABLE time_rejection_templates IS
  'Wiederverwendbare Texte für Ablehnung von Zeiteinträgen in der Freigabe.';
