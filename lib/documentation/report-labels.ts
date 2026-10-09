import type { Tenant } from '@/lib/types/database';

export const DAILY_LOG_REPORT_TYPES = ['daily_report', 'hourly_wage_rapport'] as const;

export type DailyLogReportType = (typeof DAILY_LOG_REPORT_TYPES)[number];

export const DEFAULT_DAILY_LOG_REPORT_TYPE: DailyLogReportType = 'hourly_wage_rapport';

export const DEFAULT_DAILY_REPORT_SHORT_LABEL = 'Tagesbericht';
export const DEFAULT_HOURLY_WAGE_RAPPORT_SHORT_LABEL = 'Std.-Lohnarbeit (Rapport)';
export const DEFAULT_DAILY_REPORT_TITLE = 'Tagesbericht';
export const DEFAULT_HOURLY_WAGE_RAPPORT_TITLE = 'Rapportzettel – Stundenlohn-Arbeiten';

export type TenantReportLabelConfig = {
  dailyReportLabel: string | null;
  hourlyWageRapportLabel: string | null;
};

export function tenantReportLabelsFromTenant(
  tenant: Pick<Tenant, 'daily_report_label' | 'hourly_wage_rapport_label'> | null | undefined,
): TenantReportLabelConfig {
  const daily = tenant?.daily_report_label?.trim();
  const hourly = tenant?.hourly_wage_rapport_label?.trim();
  return {
    dailyReportLabel: daily || null,
    hourlyWageRapportLabel: hourly || null,
  };
}

export function isDailyLogReportType(value: string): value is DailyLogReportType {
  return (DAILY_LOG_REPORT_TYPES as readonly string[]).includes(value);
}

export function parseDailyLogReportType(raw: string | null | undefined): DailyLogReportType {
  const value = String(raw ?? '').trim();
  return isDailyLogReportType(value) ? value : DEFAULT_DAILY_LOG_REPORT_TYPE;
}

export function defaultTitleForReportType(
  type: DailyLogReportType,
  labels?: TenantReportLabelConfig,
): string {
  if (type === 'daily_report') {
    return labels?.dailyReportLabel ?? DEFAULT_DAILY_REPORT_TITLE;
  }
  return labels?.hourlyWageRapportLabel ?? DEFAULT_HOURLY_WAGE_RAPPORT_TITLE;
}

export function shortLabelForReportType(
  type: DailyLogReportType,
  labels?: TenantReportLabelConfig,
): string {
  if (type === 'daily_report') {
    return labels?.dailyReportLabel ?? DEFAULT_DAILY_REPORT_SHORT_LABEL;
  }
  return labels?.hourlyWageRapportLabel ?? DEFAULT_HOURLY_WAGE_RAPPORT_SHORT_LABEL;
}

export function displayTitleForLog(
  type: DailyLogReportType,
  customTitle: string | null | undefined,
  labels?: TenantReportLabelConfig,
): string {
  const trimmed = customTitle?.trim();
  if (trimmed) return trimmed;
  return defaultTitleForReportType(type, labels);
}

export function isHourlyWageRapport(type: DailyLogReportType): boolean {
  return type === 'hourly_wage_rapport';
}

export function pdfFilenameStem(
  type: DailyLogReportType,
  customTitle: string | null | undefined,
  logDate: string,
  labels?: TenantReportLabelConfig,
): string {
  const title = displayTitleForLog(type, customTitle, labels);
  const slug = title
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  const prefix = type === 'daily_report' ? 'Tagesbericht' : 'Rapport';
  return slug ? `${prefix}_${logDate}_${slug}` : `${prefix}_${logDate}`;
}
