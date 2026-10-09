const BERLIN = 'Europe/Berlin';

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Montag der ISO-Woche (UTC-Datum ohne Uhrzeit). */
export function mondayOfWeek(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return formatIsoDate(d);
}

export function addDays(isoDate: string, days: number): string {
  const d = parseIsoDate(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return formatIsoDate(d);
}

/** Mo–Fr standardmäßig sichtbar; Sa–So optional ausklappbar. */
export const SCHEDULE_DEFAULT_VISIBLE_DAYS = 5;
export const SCHEDULE_WEEKEND_START_INDEX = 5;

export function weekDayLabels(): string[] {
  return ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
}

/** Mo–So als ISO-Datum ab weekStart (Montag). */
export function weekDaysFromMonday(weekStart: string): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(weekStart, i));
}

export function todayIsoInBerlin(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BERLIN }).format(new Date());
}

export function formatGermanDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
  const d = parseIsoDate(iso);
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'UTC',
    ...options,
  }).format(d);
}

export function formatGermanWeekdayDate(iso: string): string {
  return formatGermanDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function datesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA <= endB && endA >= startB;
}

export function dateInRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}
