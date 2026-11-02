import { getOpenInterval } from '@/lib/time-tracking/intervals';
import type { TimeEntry, TimeEntryInterval } from '@/lib/types/database';

function nextSortOrder(intervals: TimeEntryInterval[]): number {
  if (intervals.length === 0) return 0;
  return Math.max(...intervals.map((row) => row.sort_order)) + 1;
}

function tempIntervalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `optimistic-${crypto.randomUUID()}`;
  }
  return `optimistic-${Date.now()}`;
}

function stubInterval(
  entry: TimeEntry,
  partial: Pick<TimeEntryInterval, 'sort_order' | 'phase' | 'started_at' | 'ended_at'>,
): TimeEntryInterval {
  const created = partial.started_at;
  return {
    id: tempIntervalId(),
    tenant_id: entry.tenant_id,
    time_entry_id: entry.id,
    sort_order: partial.sort_order,
    phase: partial.phase,
    started_at: partial.started_at,
    ended_at: partial.ended_at,
    suggested_block_type: null,
    confirmed_block_type: null,
    created_at: created,
  };
}

/** Sofortige UI-Aktualisierung: Arbeit → Pause (ohne Server). */
export function optimisticPauseStartIntervals(
  entry: TimeEntry,
  intervals: TimeEntryInterval[],
  now = new Date(),
): TimeEntryInterval[] {
  const open = getOpenInterval(intervals);
  if (!open || open.phase !== 'work') {
    throw new Error('Kein offenes Arbeitsintervall.');
  }
  const nowIso = now.toISOString();
  const closed = intervals.map((row) =>
    row.id === open.id ? { ...row, ended_at: nowIso } : row,
  );
  return [
    ...closed,
    stubInterval(entry, {
      sort_order: nextSortOrder(intervals),
      phase: 'pause',
      started_at: nowIso,
      ended_at: null,
    }),
  ];
}

/** Sofortige UI-Aktualisierung: Pause → Arbeit (ohne Server). */
export function optimisticPauseEndIntervals(
  entry: TimeEntry,
  intervals: TimeEntryInterval[],
  now = new Date(),
): TimeEntryInterval[] {
  const open = getOpenInterval(intervals);
  if (!open || open.phase !== 'pause') {
    throw new Error('Kein offenes Pausenintervall.');
  }
  const nowIso = now.toISOString();
  const closed = intervals.map((row) =>
    row.id === open.id ? { ...row, ended_at: nowIso } : row,
  );
  return [
    ...closed,
    stubInterval(entry, {
      sort_order: nextSortOrder(closed),
      phase: 'work',
      started_at: nowIso,
      ended_at: null,
    }),
  ];
}
