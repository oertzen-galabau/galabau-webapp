import { addDays, formatGermanDate, parseIsoDate, todayIsoInBerlin } from '@/lib/schedule/week';

const MONTH_RE = /^\d{4}-\d{2}$/;
const YEAR_RE = /^\d{4}$/;

export type YearMonthSpan = {
  monthKey: string;
  label: string;
  colStart: number;
  colSpan: number;
};

export function normalizeMonthParam(month: string | undefined | null): string {
  if (month && MONTH_RE.test(month)) return month;
  return todayIsoInBerlin().slice(0, 7);
}

export function normalizeYearParam(
  year: string | undefined | null,
  monthFallback?: string | undefined | null,
): string {
  if (year && YEAR_RE.test(year)) return year;
  if (monthFallback && MONTH_RE.test(monthFallback)) return monthFallback.slice(0, 4);
  if (monthFallback && YEAR_RE.test(monthFallback)) return monthFallback;
  return todayIsoInBerlin().slice(0, 4);
}

export function yearFirstDay(year: string): string {
  return `${year}-01-01`;
}

export function yearLastDay(year: string): string {
  return `${year}-12-31`;
}

export function addYears(year: string, delta: number): string {
  const y = Number(year) + delta;
  return String(y);
}

export function daysInYear(year: string): string[] {
  const out: string[] = [];
  for (let m = 1; m <= 12; m += 1) {
    const month = `${year}-${String(m).padStart(2, '0')}`;
    out.push(...daysInMonth(month));
  }
  return out;
}

export function formatYearHeading(year: string): string {
  return year;
}

export function monthSpansForYear(days: string[]): YearMonthSpan[] {
  if (days.length === 0) return [];
  const spans: YearMonthSpan[] = [];
  let i = 0;
  while (i < days.length) {
    const monthKey = days[i]!.slice(0, 7);
    let j = i + 1;
    while (j < days.length && days[j]!.slice(0, 7) === monthKey) j += 1;
    spans.push({
      monthKey,
      label: formatGermanDate(`${monthKey}-01`, { month: 'short' }).replace('.', ''),
      colStart: i,
      colSpan: j - i,
    });
    i = j;
  }
  return spans;
}

export function monthFirstDay(month: string): string {
  return `${month}-01`;
}

export function monthLastDay(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const ny = d.getUTCFullYear();
  const nm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

export function daysInMonth(month: string): string[] {
  const start = monthFirstDay(month);
  const end = monthLastDay(month);
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function isoWeekNumber(isoDate: string): number {
  const d = parseIsoDate(isoDate);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function formatMonthHeading(month: string): string {
  return formatGermanDate(monthFirstDay(month), { month: 'long', year: 'numeric' });
}

export function weekdayShort(isoDate: string): string {
  return formatGermanDate(isoDate, { weekday: 'short' }).replace('.', '');
}

export function dayOfMonth(isoDate: string): number {
  return parseIsoDate(isoDate).getUTCDate();
}

export function isWeekendDay(isoDate: string): boolean {
  const dow = parseIsoDate(isoDate).getUTCDay();
  return dow === 0 || dow === 6;
}
