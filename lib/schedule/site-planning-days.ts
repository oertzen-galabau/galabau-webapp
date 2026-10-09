import { dateInRange } from '@/lib/schedule/week';

export type EntryDateRange = {
  site_id: string;
  start_date: string;
  end_date: string;
};

/** Pro Baustelle: Indizes 0–6 (Mo–So) an denen mindestens ein Einsatz liegt. */
export function siteDayIndicesInWeek(
  entries: EntryDateRange[],
  weekDays: string[],
): Map<string, Set<number>> {
  const bySite = new Map<string, Set<number>>();

  for (const entry of entries) {
    let set = bySite.get(entry.site_id);
    if (!set) {
      set = new Set();
      bySite.set(entry.site_id, set);
    }
    weekDays.forEach((day, idx) => {
      if (dateInRange(day, entry.start_date, entry.end_date)) {
        set!.add(idx);
      }
    });
  }

  return bySite;
}

/** z. B. [0, 2, 3, 4] → "Mo, Mi–Fr" */
export function formatDayIndexRanges(dayIndices: number[], dayLabels: string[]): string {
  if (!dayIndices.length) return '';
  const sorted = [...new Set(dayIndices)].sort((a, b) => a - b);
  const parts: string[] = [];
  let runStart = sorted[0];
  let runEnd = sorted[0];

  const flush = () => {
    if (runStart === runEnd) {
      parts.push(dayLabels[runStart] ?? '?');
    } else {
      parts.push(`${dayLabels[runStart] ?? '?'}–${dayLabels[runEnd] ?? '?'}`);
    }
  };

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === runEnd + 1) {
      runEnd = sorted[i];
    } else {
      flush();
      runStart = sorted[i];
      runEnd = sorted[i];
    }
  }
  flush();
  return parts.join(', ');
}
