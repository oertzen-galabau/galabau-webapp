import type { TimeBlockType, TimeEntryInterval } from '@/lib/types/database';
import { toTimeString } from '@/lib/time-tracking/work-day';
import { mergeAdjacentBlocks, type TimelineBlockInput } from '@/lib/time-tracking/timeline';

function intervalEndTime(
  row: TimeEntryInterval,
  dayEndTime: string,
  timeZone: string,
): string {
  if (row.ended_at) return toTimeString(new Date(row.ended_at), timeZone).slice(0, 5);
  return dayEndTime.slice(0, 5);
}

function intervalStartTime(row: TimeEntryInterval, timeZone: string): string {
  return toTimeString(new Date(row.started_at), timeZone).slice(0, 5);
}

function pauseBlockType(row: TimeEntryInterval): TimeBlockType {
  return (
    row.confirmed_block_type ??
    row.suggested_block_type ??
    'travel'
  );
}

/** Erzeugt Timeline-Blöcke aus bestätigten/offenen Intervallen (Feierabend-Vorschau). */
export function buildTimelineFromIntervals(params: {
  intervals: TimeEntryInterval[];
  dayEndTime: string;
  defaultSiteId?: string | null;
  timeZone?: string;
}): TimelineBlockInput[] {
  const timeZone = params.timeZone ?? 'Europe/Berlin';
  const sorted = [...params.intervals].sort(
    (a, b) => Date.parse(a.started_at) - Date.parse(b.started_at),
  );

  const blocks: TimelineBlockInput[] = [];
  for (const row of sorted) {
    const start_time = intervalStartTime(row, timeZone);
    const end_time = intervalEndTime(row, params.dayEndTime, timeZone);
    if (start_time >= end_time) continue;

    if (row.phase === 'pause') {
      blocks.push({
        block_type: pauseBlockType(row),
        start_time,
        end_time,
      });
      continue;
    }

    if (params.defaultSiteId) {
      blocks.push({
        block_type: 'site_work',
        start_time,
        end_time,
        site_id: params.defaultSiteId,
      });
    } else {
      blocks.push({ block_type: 'other_work', start_time, end_time });
    }
  }

  return mergeAdjacentBlocks(blocks);
}

export type LegacyBreakFields = {
  breakfast_start: string | null;
  breakfast_end: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
};

/** Spiegelt erste Frühstücks-/Mittagspause aus Intervallen in Legacy-Spalten. */
export function legacyBreakFieldsFromIntervals(
  intervals: TimeEntryInterval[],
  timeZone = 'Europe/Berlin',
): LegacyBreakFields {
  const result: LegacyBreakFields = {
    breakfast_start: null,
    breakfast_end: null,
    lunch_start: null,
    lunch_end: null,
  };

  for (const row of intervals) {
    if (row.phase !== 'pause' || !row.ended_at) continue;
    const type = row.confirmed_block_type ?? row.suggested_block_type;
    if (type !== 'breakfast' && type !== 'lunch') continue;

    const start = toTimeString(new Date(row.started_at), timeZone);
    const end = toTimeString(new Date(row.ended_at), timeZone);

    if (type === 'breakfast' && !result.breakfast_start) {
      result.breakfast_start = start;
      result.breakfast_end = end;
    }
    if (type === 'lunch' && !result.lunch_start) {
      result.lunch_start = start;
      result.lunch_end = end;
    }
  }

  return result;
}
