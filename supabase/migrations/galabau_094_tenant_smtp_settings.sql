-- SMTP-Einstellungen pro Mandant (fachliche Mails: Rapporte, Bestellungen, Einsatzplan)

CREATE TABLE IF NOT EXISTS tenant_smtp_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 587,
  secure boolean NOT NULL DEFAULT false,
  smtp_user text,
  password_encrypted text NOT NULL,
  from_email text NOT NULL,
  from_name text,
  reply_to text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tenant_smtp_settings IS
  'SMTP für fachliche Mandanten-Mails. Transaktionsmails (Passwort-Reset, Einladungen) laufen über App-SMTP.';

ALTER TABLE tenant_smtp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_smtp_settings_select ON tenant_smtp_settings
  FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_smtp_settings_insert ON tenant_smtp_settings
  FOR INSERT
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('settings.smtp'::text)
    )
  );

CREATE POLICY tenant_smtp_settings_update ON tenant_smtp_settings
  FOR UPDATE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('settings.smtp'::text)
    )
  )
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_smtp_settings_delete ON tenant_smtp_settings
  FOR DELETE
  USING (
    tenant_id = current_tenant_id()
    AND (
      has_tenant_role(ARRAY['verwaltung'::user_role, 'administrator'::user_role])
      OR has_tenant_permission('settings.smtp'::text)
    )
  );

REVOKE SELECT (password_encrypted) ON tenant_smtp_settings FROM authenticated;
REVOKE SELECT (password_encrypted) ON tenant_smtp_settings FROM anon;

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'settings.smtp', true
FROM tenant_roles tr
WHERE tr.slug IN ('verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO UPDATE SET granted = EXCLUDED.granted;
