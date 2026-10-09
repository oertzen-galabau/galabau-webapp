import { dateInRange } from '@/lib/schedule/week';
import type { ScheduleEntryView } from '@/lib/schedule/load-plan-data';

export type WeekEntryLayout = {
  entry: ScheduleEntryView;
  row: number;
  colStart: number;
  colSpan: number;
};

function columnSpanForEntry(entry: ScheduleEntryView, weekDays: string[]): { start: number; span: number } {
  let start = -1;
  let end = -1;
  weekDays.forEach((day, idx) => {
    if (dateInRange(day, entry.start_date, entry.end_date)) {
      if (start < 0) start = idx;
      end = idx;
    }
  });
  if (start < 0) return { start: 0, span: 1 };
  return { start, span: end - start + 1 };
}

export function layoutWeekEntries(entries: ScheduleEntryView[], weekDays: string[]): WeekEntryLayout[] {
  const sorted = [...entries].sort(
    (a, b) => a.start_date.localeCompare(b.start_date) || a.start_time.localeCompare(b.start_time),
  );
  const occupied: boolean[][] = [];
  const result: WeekEntryLayout[] = [];

  for (const entry of sorted) {
    const { start, span } = columnSpanForEntry(entry, weekDays);
    let row = 0;
    while (true) {
      if (!occupied[row]) occupied[row] = Array(weekDays.length).fill(false);
      let fits = true;
      for (let c = start; c < start + span; c++) {
        if (occupied[row][c]) {
          fits = false;
          break;
        }
      }
      if (fits) {
        for (let c = start; c < start + span; c++) occupied[row][c] = true;
        result.push({ entry, row, colStart: start, colSpan: span });
        break;
      }
      row += 1;
    }
  }

  return result;
}

/** Kürzt Spalten auf sichtbare Wochentage (z. B. Mo–Fr ohne ausgeklapptes Wochenende). */
export function layoutEntriesForVisibleDays(
  layout: WeekEntryLayout[],
  visibleDayCount: number,
): WeekEntryLayout[] {
  const out: WeekEntryLayout[] = [];
  for (const item of layout) {
    if (item.colStart >= visibleDayCount) continue;
    const endCol = item.colStart + item.colSpan;
    const visibleEnd = Math.min(endCol, visibleDayCount);
    const span = visibleEnd - item.colStart;
    if (span <= 0) continue;
    out.push({ ...item, colSpan: span });
  }
  return out;
}
