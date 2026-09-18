-- Mandantenfähige Lohnregeln

ALTER TABLE payroll_booking_codes
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

UPDATE payroll_booking_codes SET is_system = true WHERE code IN (
  '1000', '1001', '1002', '1004', '1005', '1006', '1007', '1650', '2013', '8057', '8110'
);

CREATE TABLE IF NOT EXISTS payroll_tenant_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_payroll_tenant_rules_tenant
  ON payroll_tenant_rules (tenant_id);

-- Default-Regeln für bestehende Mandanten (GaLaBau-Setup)
INSERT INTO payroll_tenant_rules (tenant_id, rule_key, enabled, config)
SELECT t.id, v.rule_key, true, v.config::jsonb
FROM tenants t
CROSS JOIN (
  VALUES
    ('normal_hours', '{"code":"1000"}'),
    ('lkw_hours', '{"code":"1001"}'),
    ('driver_allowance', '{"tax_free_code":"1004","taxable_code":"1005","threshold_minutes":420,"amount_eur":6}'),
    ('driver_travel_time', '{"code":"2013","threshold_minutes":30}'),
    ('passenger_travel_allowance', '{"tax_free_code":"1006","taxable_code":"1007","threshold_minutes":420,"amount_eur":6,"travel_threshold_minutes":30}'),
    ('leave_vacation', '{"code":"8057"}'),
    ('leave_sick', '{"code":"1650"}'),
    ('leave_school', '{"code":"1002"}'),
    ('bad_weather', '{"code":"8110","min_work_minutes":60}')
) AS v(rule_key, config)
ON CONFLICT (tenant_id, rule_key) DO NOTHING;

INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, 'settings.payroll_rules', true
FROM tenant_roles tr
WHERE tr.slug IN ('verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO NOTHING;
