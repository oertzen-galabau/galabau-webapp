export const DAILY_LOG_REPORT_TYPES = ['daily_report', 'hourly_wage_rapport'] as const;

export type DailyLogReportType = (typeof DAILY_LOG_REPORT_TYPES)[number];

export const DEFAULT_DAILY_LOG_REPORT_TYPE: DailyLogReportType = 'hourly_wage_rapport';

export function isDailyLogReportType(value: string): value is DailyLogReportType {
  return (DAILY_LOG_REPORT_TYPES as readonly string[]).includes(value);
}

export function parseDailyLogReportType(raw: string | null | undefined): DailyLogReportType {
  const value = String(raw ?? '').trim();
  return isDailyLogReportType(value) ? value : DEFAULT_DAILY_LOG_REPORT_TYPE;
}

export function defaultTitleForReportType(type: DailyLogReportType): string {
  return type === 'daily_report' ? 'Tagesbericht' : 'Rapportzettel – Stundenlohn-Arbeiten';
}

export function shortLabelForReportType(type: DailyLogReportType): string {
  return type === 'daily_report' ? 'Tagesbericht' : 'Std.-Lohnarbeit (Rapport)';
}

export function displayTitleForLog(
  type: DailyLogReportType,
  customTitle: string | null | undefined,
): string {
  const trimmed = customTitle?.trim();
  if (trimmed) return trimmed;
  return defaultTitleForReportType(type);
}

export function isHourlyWageRapport(type: DailyLogReportType): boolean {
  return type === 'hourly_wage_rapport';
}

export function pdfFilenameStem(
  type: DailyLogReportType,
  customTitle: string | null | undefined,
  logDate: string,
): string {
  const title = displayTitleForLog(type, customTitle);
  const slug = title
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  const prefix = type === 'daily_report' ? 'Tagesbericht' : 'Rapport';
  return slug ? `${prefix}_${logDate}_${slug}` : `${prefix}_${logDate}`;
}
