import { addDays, formatGermanDate, parseIsoDate, todayIsoInBerlin } from '@/lib/schedule/week';

const MONTH_RE = /^\d{4}-\d{2}$/;

export function normalizeMonthParam(month: string | undefined | null): string {
  if (month && MONTH_RE.test(month)) return month;
  return todayIsoInBerlin().slice(0, 7);
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
