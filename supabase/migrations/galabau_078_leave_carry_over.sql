-- Resturlaub Vorjahr: Herkunft in leave_balances, Verfallsstichtag pro Mandant

ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS carried_over_source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.leave_balances
  DROP CONSTRAINT IF EXISTS leave_balances_carried_over_source_check;

ALTER TABLE public.leave_balances
  ADD CONSTRAINT leave_balances_carried_over_source_check
  CHECK (carried_over_source IN ('manual', 'automatic'));

UPDATE public.leave_balances
SET carried_over_source = 'manual'
WHERE carried_over_source IS NULL;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS leave_carry_expire_month smallint,
  ADD COLUMN IF NOT EXISTS leave_carry_expire_day smallint;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_leave_carry_expire_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_leave_carry_expire_check
  CHECK (
    (leave_carry_expire_month IS NULL AND leave_carry_expire_day IS NULL)
    OR (
      leave_carry_expire_month BETWEEN 1 AND 12
      AND leave_carry_expire_day BETWEEN 1 AND 31
    )
  );

COMMENT ON COLUMN public.leave_balances.carried_over_source IS
  'manual = Verwaltung setzt Resturlaub; automatic = aus Vorjahres-Rest berechnet';

COMMENT ON COLUMN public.tenants.leave_carry_expire_month IS
  'Monat (1–12) bis wann Resturlaub aus dem Vorjahr genutzt sein muss; NULL = kein Verfall';

COMMENT ON COLUMN public.tenants.leave_carry_expire_day IS
  'Tag im Monat für Verfall des Resturlaubs; nur zusammen mit leave_carry_expire_month';
