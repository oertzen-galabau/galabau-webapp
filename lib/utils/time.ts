export function parseTime(value: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function formatDurationHMS(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function calculateWorkMinutes(entry: {
  start_time: string | null;
  end_time: string | null;
  breakfast_start: string | null;
  breakfast_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  travel_minutes?: number;
}) {
  const start = parseTime(entry.start_time);
  const end = parseTime(entry.end_time);
  if (start == null || end == null || end <= start) return 0;

  let minutes = end - start;
  const breakfastStart = parseTime(entry.breakfast_start);
  const breakfastEnd = parseTime(entry.breakfast_end);
  if (breakfastStart != null && breakfastEnd != null && breakfastEnd > breakfastStart) {
    minutes -= breakfastEnd - breakfastStart;
  }
  const lunchStart = parseTime(entry.lunch_start);
  const lunchEnd = parseTime(entry.lunch_end);
  if (lunchStart != null && lunchEnd != null && lunchEnd > lunchStart) {
    minutes -= lunchEnd - lunchStart;
  }
  return Math.max(0, minutes);
}

export function businessDaysBetween(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Zählt die Werktage zwischen zwei Daten (inklusive), ausgenommen
 * Wochenenden und Tage, die in einen Betriebsurlaub-Zeitraum fallen.
 * Wird genutzt, um bei Genehmigung eines Urlaubsantrags automatisch
 * die verbrauchten Urlaubstage zu berechnen.
 */
export function countLeaveDays(
  start: string,
  end: string,
  companyHolidays: { start_date: string; end_date: string }[] = [],
) {
  const s = new Date(start);
  const e = new Date(end);
  const holidayRanges = companyHolidays.map((h) => ({
    start: new Date(h.start_date),
    end: new Date(h.end_date),
  }));

  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    const isWeekend = day === 0 || day === 6;
    const isCompanyHoliday = holidayRanges.some((range) => cur >= range.start && cur <= range.end);
    if (!isWeekend && !isCompanyHoliday) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
