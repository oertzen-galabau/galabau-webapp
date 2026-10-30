import { isoDateInBerlin, minutesSinceMidnightInBerlin } from '@/lib/schedule/entry-phase';

export const DAY_TIMELINE_START_HOUR = 6;
export const DAY_TIMELINE_END_HOUR = 20;
export const DAY_TIMELINE_START_MIN = DAY_TIMELINE_START_HOUR * 60;
export const DAY_TIMELINE_END_MIN = DAY_TIMELINE_END_HOUR * 60;
export const DAY_TIMELINE_TOTAL_MIN = DAY_TIMELINE_END_MIN - DAY_TIMELINE_START_MIN;
/** Pixelhöhe pro Stunde im Tagesraster */
export const DAY_TIMELINE_PX_PER_HOUR = 56;
/** Max. nebeneinander sichtbare Einsätze; darüber horizontal scrollen (Fallback vor Messung) */
export const DAY_TIMELINE_MAX_VISIBLE_COLUMNS = 5;
/** Auf schmalen Viewports (s. `DAY_TIMELINE_COMPACT_MEDIA_QUERY`, Fallback) */
export const DAY_TIMELINE_MAX_VISIBLE_COLUMNS_COMPACT = 4;
export const DAY_TIMELINE_COMPACT_MEDIA_QUERY = '(max-width: 760px)';

export function dayTimelineMaxVisibleColumns(compactViewport: boolean): number {
  return compactViewport
    ? DAY_TIMELINE_MAX_VISIBLE_COLUMNS_COMPACT
    : DAY_TIMELINE_MAX_VISIBLE_COLUMNS;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

export function formatTimelineHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export type EntryBlockLayout = {
  topPercent: number;
  heightPercent: number;
};

export function entryBlockLayout(startTime: string, endTime: string): EntryBlockLayout {
  let start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) end = start + 30;

  const visibleStart = Math.max(start, DAY_TIMELINE_START_MIN);
  const visibleEnd = Math.min(end, DAY_TIMELINE_END_MIN);

  if (visibleEnd <= visibleStart) {
    if (end <= DAY_TIMELINE_START_MIN) {
      return { topPercent: 0, heightPercent: 2 };
    }
    return { topPercent: 98, heightPercent: 2 };
  }

  const topPercent = ((visibleStart - DAY_TIMELINE_START_MIN) / DAY_TIMELINE_TOTAL_MIN) * 100;
  let heightPercent = ((visibleEnd - visibleStart) / DAY_TIMELINE_TOTAL_MIN) * 100;
  heightPercent = Math.max(heightPercent, 2);

  return { topPercent, heightPercent };
}

export function nowLinePercent(now: Date, selectedDayIso: string): number | null {
  if (isoDateInBerlin(now) !== selectedDayIso) return null;
  const min = minutesSinceMidnightInBerlin(now);
  if (min < DAY_TIMELINE_START_MIN || min > DAY_TIMELINE_END_MIN) return null;
  return ((min - DAY_TIMELINE_START_MIN) / DAY_TIMELINE_TOTAL_MIN) * 100;
}

export function dayTimelineGridHeightPx(): number {
  return (DAY_TIMELINE_END_HOUR - DAY_TIMELINE_START_HOUR) * DAY_TIMELINE_PX_PER_HOUR;
}

export type DayTimelineEntryPick = {
  id: string;
  start_time: string;
  end_time: string;
  sort_order?: number;
};

export type DayTimelineEventLayout = EntryBlockLayout & {
  columnIndex: number;
  columnCount: number;
  leftPercent: number;
  widthPercent: number;
  /** >1 wenn das Raster breiter als der sichtbare Bereich ist (horizontal scrollen) */
  gridWidthFactor: number;
};

const TIMELINE_H_PAD_PERCENT = 2;
const TIMELINE_COL_GAP_PERCENT = 1;

function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  return as < be && bs < ae;
}

function clusterOverlappingEntries(entries: DayTimelineEntryPick[]): DayTimelineEntryPick[][] {
  if (entries.length === 0) return [];

  const parent = entries.map((_, i) => i);
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      if (timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) {
        union(i, j);
      }
    }
  }

  const byRoot = new Map<number, DayTimelineEntryPick[]>();
  for (let i = 0; i < entries.length; i += 1) {
    const root = find(i);
    const list = byRoot.get(root) ?? [];
    list.push(entries[i]);
    byRoot.set(root, list);
  }
  return [...byRoot.values()];
}

function columnRect(
  columnIndex: number,
  columnCount: number,
  maxVisible: number,
): { leftPercent: number; widthPercent: number; gridWidthFactor: number } {
  const gridWidthFactor = columnCount > maxVisible ? columnCount / maxVisible : 1;

  if (columnCount <= 1) {
    return {
      leftPercent: TIMELINE_H_PAD_PERCENT,
      widthPercent: 100 - 2 * TIMELINE_H_PAD_PERCENT,
      gridWidthFactor: 1,
    };
  }

  if (columnCount <= maxVisible) {
    const totalGap = (columnCount - 1) * TIMELINE_COL_GAP_PERCENT;
    const widthPercent = (100 - 2 * TIMELINE_H_PAD_PERCENT - totalGap) / columnCount;
    const leftPercent = TIMELINE_H_PAD_PERCENT + columnIndex * (widthPercent + TIMELINE_COL_GAP_PERCENT);
    return { leftPercent, widthPercent, gridWidthFactor: 1 };
  }

  const layoutCols = maxVisible;
  const totalGap = (layoutCols - 1) * TIMELINE_COL_GAP_PERCENT;
  const slotWidthViewport = (100 - 2 * TIMELINE_H_PAD_PERCENT - totalGap) / layoutCols;
  const leftViewport =
    TIMELINE_H_PAD_PERCENT + columnIndex * (slotWidthViewport + TIMELINE_COL_GAP_PERCENT);
  return {
    leftPercent: leftViewport / gridWidthFactor,
    widthPercent: slotWidthViewport / gridWidthFactor,
    gridWidthFactor,
  };
}

/** Breite des Tagesrasters in Prozent des sichtbaren Bereichs (100 = kein Horizontal-Scroll). */
export function dayTimelineGridWidthPercent(layouts: Iterable<DayTimelineEventLayout>): number {
  let factor = 1;
  for (const layout of layouts) {
    if (layout.gridWidthFactor > factor) factor = layout.gridWidthFactor;
  }
  return factor * 100;
}

function compareTimelineLaneOrder(a: DayTimelineEntryPick, b: DayTimelineEntryPick): number {
  const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
  if (orderDiff !== 0) return orderDiff;
  const startDiff = timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
  if (startDiff !== 0) return startDiff;
  return a.id.localeCompare(b.id);
}

function assignLanes(cluster: DayTimelineEntryPick[]): Map<string, number> {
  const sorted = [...cluster].sort(compareTimelineLaneOrder);

  const laneEnds: number[] = [];
  const laneById = new Map<string, number>();

  for (const entry of sorted) {
    const start = timeToMinutes(entry.start_time);
    let end = timeToMinutes(entry.end_time);
    if (end <= start) end = start + 30;

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    laneById.set(entry.id, lane);
  }

  return laneById;
}

/** Vertikale Position + horizontale Spalten bei zeitlicher Überlappung. */
export type LayoutDayTimelineColumnsOptions = {
  maxVisibleColumns?: number;
};

export function layoutDayTimelineColumns(
  entries: DayTimelineEntryPick[],
  options?: LayoutDayTimelineColumnsOptions,
): Map<string, DayTimelineEventLayout> {
  const maxVisible = options?.maxVisibleColumns ?? DAY_TIMELINE_MAX_VISIBLE_COLUMNS;
  const result = new Map<string, DayTimelineEventLayout>();
  const clusters = clusterOverlappingEntries(entries);

  for (const cluster of clusters) {
    const laneById = assignLanes(cluster);
    const columnCount = Math.max(1, ...[...laneById.values()].map((l) => l + 1));

    for (const entry of cluster) {
      const block = entryBlockLayout(entry.start_time, entry.end_time);
      const columnIndex = laneById.get(entry.id) ?? 0;
      const { leftPercent, widthPercent, gridWidthFactor } = columnRect(
        columnIndex,
        columnCount,
        maxVisible,
      );
      result.set(entry.id, {
        ...block,
        columnIndex,
        columnCount,
        leftPercent,
        widthPercent,
        gridWidthFactor,
      });
    }
  }

  return result;
}
