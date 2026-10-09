-- Payroll-Tabellen: RLS + Mandantenisolation

ALTER TABLE public.payroll_booking_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_season_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_tenant_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bad_weather_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_payroll_booking_codes ON public.payroll_booking_codes;
CREATE POLICY tenant_isolation_payroll_booking_codes ON public.payroll_booking_codes
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_payroll_bookings ON public.payroll_bookings;
CREATE POLICY tenant_isolation_payroll_bookings ON public.payroll_bookings
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_payroll_season_config ON public.payroll_season_config;
CREATE POLICY tenant_isolation_payroll_season_config ON public.payroll_season_config
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_payroll_tenant_rules ON public.payroll_tenant_rules;
CREATE POLICY tenant_isolation_payroll_tenant_rules ON public.payroll_tenant_rules
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_bad_weather_days ON public.bad_weather_days;
CREATE POLICY tenant_isolation_bad_weather_days ON public.bad_weather_days
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'payroll_booking_codes',
    'payroll_bookings',
    'payroll_season_config',
    'payroll_tenant_rules',
    'bad_weather_days'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS password_change_gate ON public.%I', target);
    EXECUTE format(
      'CREATE POLICY password_change_gate ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.current_user_password_ready()) WITH CHECK (public.current_user_password_ready())',
      target
    );
  END LOOP;
END
$$;
