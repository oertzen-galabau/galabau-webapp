import type { ScheduleEntryView } from '@/lib/schedule/load-plan-data';

type SortableEntry = Pick<ScheduleEntryView, 'sort_order' | 'start_time' | 'site'> & { id: string };

/** Anzeige-Reihenfolge: manuelle Sortierung, dann Uhrzeit, dann Baustellenname. */
export function compareScheduleEntriesForDisplay(a: SortableEntry, b: SortableEntry): number {
  const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
  if (orderDiff !== 0) return orderDiff;
  const timeDiff = a.start_time.localeCompare(b.start_time);
  if (timeDiff !== 0) return timeDiff;
  const nameDiff = a.site.name.localeCompare(b.site.name, 'de');
  if (nameDiff !== 0) return nameDiff;
  return a.id.localeCompare(b.id);
}

export function sortScheduleEntriesForDisplay<T extends SortableEntry>(entries: T[]): T[] {
  return [...entries].sort(compareScheduleEntriesForDisplay);
}

/** Einsatz `activeId` an Position von `overId` setzen. */
export function reorderEntryIds(ids: readonly string[], activeId: string, overId: string): string[] {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
}
