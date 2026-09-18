-- Buchungsnummern, Segmente, Schlechtwetter

CREATE TYPE payroll_booking_unit AS ENUM ('hours', 'eur');
CREATE TYPE payroll_booking_source AS ENUM ('auto', 'manual');

ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'schule';

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS default_travel_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS is_driver boolean;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS payroll_flags jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS payroll_booking_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  unit payroll_booking_unit NOT NULL DEFAULT 'hours',
  is_tax_free boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE IF NOT EXISTS payroll_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_code text NOT NULL,
  quantity numeric(10, 2) NOT NULL,
  unit payroll_booking_unit NOT NULL,
  source payroll_booking_source NOT NULL DEFAULT 'auto',
  time_entry_id uuid REFERENCES time_entries(id) ON DELETE CASCADE,
  leave_request_id uuid REFERENCES leave_requests(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  notes text,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS time_entry_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  time_entry_id uuid NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  travel_minutes integer NOT NULL DEFAULT 0,
  start_time time,
  end_time time,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bad_weather_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  marked_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, work_date)
);

CREATE TABLE IF NOT EXISTS payroll_season_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  weekday integer NOT NULL CHECK (weekday >= 1 AND weekday <= 5),
  max_hours numeric(4, 2) NOT NULL,
  UNIQUE (tenant_id, month, weekday)
);

CREATE INDEX IF NOT EXISTS idx_payroll_bookings_tenant_date
  ON payroll_bookings (tenant_id, work_date);

CREATE INDEX IF NOT EXISTS idx_payroll_bookings_time_entry
  ON payroll_bookings (time_entry_id)
  WHERE time_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_time_entry_segments_entry
  ON time_entry_segments (time_entry_id);

-- Standard-Buchungscodes pro Mandant
INSERT INTO payroll_booking_codes (tenant_id, code, label, unit, is_tax_free, sort_order)
SELECT t.id, v.code, v.label, v.unit::payroll_booking_unit, v.is_tax_free, v.sort_order
FROM tenants t
CROSS JOIN (
  VALUES
    ('1000', 'Normalstunden', 'hours', false, 1),
    ('1001', 'LKW-Std', 'hours', false, 2),
    ('1002', 'Schule', 'hours', false, 3),
    ('1004', 'Fahrer-Zuschlag steuerfrei', 'eur', true, 4),
    ('1005', 'Fahrer-Zuschlag steuerpflichtig', 'eur', false, 5),
    ('1006', 'Wegegeld steuerfrei', 'eur', true, 6),
    ('1007', 'Wegegeld steuerpflichtig', 'eur', false, 7),
    ('1650', 'Krank', 'hours', false, 8),
    ('2013', 'Wegezeit Fahrer', 'hours', false, 9),
    ('8057', 'Urlaub', 'hours', false, 10),
    ('8110', 'Saison KUG Schlechtwetter', 'hours', false, 11)
) AS v(code, label, unit, is_tax_free, sort_order)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Schlechtwetter-Sollwerte Dez–Mär (Mo=1 … Fr=5)
INSERT INTO payroll_season_config (tenant_id, month, weekday, max_hours)
SELECT t.id, v.month, v.weekday, v.max_hours
FROM tenants t
CROSS JOIN (
  VALUES
    (12, 1, 7.5), (12, 2, 7.5), (12, 3, 7.5), (12, 4, 7.5), (12, 5, 6.0),
    (1, 1, 7.5), (1, 2, 7.5), (1, 3, 7.5), (1, 4, 7.5), (1, 5, 6.0),
    (2, 1, 8.0), (2, 2, 8.0), (2, 3, 8.0), (2, 4, 8.0), (2, 5, 6.5),
    (3, 1, 8.5), (3, 2, 8.5), (3, 3, 8.5), (3, 4, 8.5), (3, 5, 6.5)
) AS v(month, weekday, max_hours)
ON CONFLICT (tenant_id, month, weekday) DO NOTHING;

-- Neue Berechtigungen
INSERT INTO tenant_role_permissions (tenant_role_id, permission_key, granted)
SELECT tr.id, perm.key, true
FROM tenant_roles tr
CROSS JOIN (VALUES ('zeiten.bookings.edit'), ('zeiten.bad_weather.mark')) AS perm(key)
WHERE tr.slug IN ('vorarbeiter', 'verwaltung', 'administrator')
ON CONFLICT (tenant_role_id, permission_key) DO NOTHING;
