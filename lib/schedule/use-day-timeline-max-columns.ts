'use client';

import { useEffect, useState, type RefObject } from 'react';
import {
  DAY_TIMELINE_MAX_VISIBLE_COLUMNS,
  DAY_TIMELINE_MAX_VISIBLE_COLUMNS_COMPACT,
  DAY_TIMELINE_COMPACT_MEDIA_QUERY,
} from '@/lib/schedule/day-timeline';

/** Mindestbreite einer Einsatz-Spalte im Tagesraster (px). */
const MIN_COLUMN_PX = 168;

function maxColumnsForGridWidth(widthPx: number): number {
  const usable = Math.max(0, widthPx - 8);
  const fromWidth = Math.floor(usable / MIN_COLUMN_PX);
  return Math.max(2, Math.min(8, fromWidth));
}

/**
 * Ermittelt max. nebeneinander sichtbare Baustellen-Spalten aus der Rasterbreite
 * (nicht Viewport — Sidebar reduziert den Platz).
 */
export function useDayTimelineMaxVisibleColumns(
  gridScrollRef: RefObject<HTMLElement | null>,
): number {
  const [maxColumns, setMaxColumns] = useState(DAY_TIMELINE_MAX_VISIBLE_COLUMNS);

  useEffect(() => {
    const el = gridScrollRef.current;
    if (!el) return;

    const update = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      setMaxColumns(maxColumnsForGridWidth(w));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridScrollRef]);

  return maxColumns;
}

/** Fallback vor Messung / SSR: Viewport-Schwelle wie bisher, Default breiter Desktop. */
export function dayTimelineMaxVisibleColumnsFallback(compactViewport: boolean): number {
  return compactViewport
    ? DAY_TIMELINE_MAX_VISIBLE_COLUMNS_COMPACT
    : DAY_TIMELINE_MAX_VISIBLE_COLUMNS;
}

export function isDayTimelineCompactViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(DAY_TIMELINE_COMPACT_MEDIA_QUERY).matches;
}
