import { addDays, formatIsoDate, mondayOfWeek, parseIsoDate } from '@/lib/schedule/week';

export type MonthGridCell = {
  iso: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
};

/** year/month: 1-basierter Monat; Mo–So, 6 Zeilen à 7 Tage. */
export function buildMonthGrid(year: number, month: number): MonthGridCell[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const monthStartIso = formatIsoDate(firstOfMonth);
  const gridStartIso = mondayOfWeek(monthStartIso);

  const cells: MonthGridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const iso = addDays(gridStartIso, i);
    const d = parseIsoDate(iso);
    cells.push({
      iso,
      dayOfMonth: d.getUTCDate(),
      inCurrentMonth: d.getUTCFullYear() === year && d.getUTCMonth() === month - 1,
    });
  }
  return cells;
}

export function splitPrimaryAndExtraDates(selected: string[]): {
  primary: string;
  extras: string[];
} {
  const unique = [...new Set(selected.filter(Boolean))].sort();
  if (!unique.length) {
    return { primary: '', extras: [] };
  }
  const [primary, ...extras] = unique;
  return { primary, extras };
}

export function isoToViewMonth(iso: string): { year: number; month: number } {
  const d = parseIsoDate(iso);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function shiftViewMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  let m = month + delta;
  let y = year;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

export function formatMonthLabel(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(d);
}
