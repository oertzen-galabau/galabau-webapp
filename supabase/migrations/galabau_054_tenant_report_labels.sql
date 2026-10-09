-- Mandanten-Bezeichnungen für Berichtsarten (Tagesbericht / Std.-Lohn-Rapport)

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS daily_report_label text,
  ADD COLUMN IF NOT EXISTS hourly_wage_rapport_label text;

COMMENT ON COLUMN public.tenants.daily_report_label IS
  'Anzeigename für report_type daily_report; leer = Standard „Tagesbericht“.';

COMMENT ON COLUMN public.tenants.hourly_wage_rapport_label IS
  'Anzeigename für report_type hourly_wage_rapport; leer = Standard „Std.-Lohnarbeit (Rapport)“.';
