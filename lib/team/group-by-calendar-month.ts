export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export type CalendarMonthGroup<T> = {
  monthKey: string;
  label: string;
  items: T[];
};

export function groupByCalendarMonth<T>(
  items: T[],
  dateIso: (item: T) => string,
): CalendarMonthGroup<T>[] {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const iso = dateIso(item);
    if (!iso || iso.length < 7) continue;
    const monthKey = iso.slice(0, 7);
    const bucket = map.get(monthKey) ?? [];
    bucket.push(item);
    map.set(monthKey, bucket);
  }

  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, groupItems]) => ({
      monthKey,
      label: formatMonthLabel(monthKey),
      items: [...groupItems].sort((a, b) => dateIso(b).localeCompare(dateIso(a))),
    }));
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
