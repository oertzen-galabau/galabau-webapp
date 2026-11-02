import type { SupabaseClient } from '@supabase/supabase-js';
import type { TimeEntryInterval } from '@/lib/types/database';
import type { TimeEntryLike } from '@/lib/time-tracking/work-day';
import { loadEntryIntervals, openInterval, closeOpenInterval } from '@/lib/time-tracking/intervals';

function workDateToIso(workDate: string, time: string): string {
  const t = time.length >= 8 ? time.slice(0, 8) : `${time.slice(0, 5)}:00`;
  return `${workDate}T${t}+01:00`;
}

/** Erzeugt Intervalle aus Legacy breakfast/lunch-Spalten, wenn noch keine existieren. */
export async function ensureLegacyIntervalsMigrated(
  supabase: SupabaseClient,
  tenantId: string,
  entry: TimeEntryLike & { id: string; work_date: string },
): Promise<TimeEntryInterval[]> {
  const existing = await loadEntryIntervals(supabase, entry.id);
  if (existing.length > 0) return existing;
  if (!entry.start_time) return [];

  const workDate = entry.work_date;
  let sortOrder = 0;

  async function insertClosed(
    phase: 'work' | 'pause',
    startIso: string,
    endIso: string,
    suggested?: import('@/lib/types/database').TimeBlockType,
  ) {
    const { error } = await supabase.from('time_entry_intervals').insert({
      tenant_id: tenantId,
      time_entry_id: entry.id,
      sort_order: sortOrder++,
      phase,
      started_at: startIso,
      ended_at: endIso,
      suggested_block_type: suggested ?? null,
      confirmed_block_type: suggested ?? null,
    });
    if (error) throw new Error(error.message);
  }

  const dayStart = workDateToIso(workDate, entry.start_time);
  const pauses: { start: string; end: string; type: 'breakfast' | 'lunch' }[] = [];

  if (entry.breakfast_start && entry.breakfast_end) {
    pauses.push({
      start: workDateToIso(workDate, entry.breakfast_start),
      end: workDateToIso(workDate, entry.breakfast_end),
      type: 'breakfast',
    });
  } else if (entry.breakfast_start && !entry.breakfast_end) {
    const pauseStart = workDateToIso(workDate, entry.breakfast_start);
    if (Date.parse(pauseStart) > Date.parse(dayStart)) {
      await insertClosed('work', dayStart, pauseStart);
    }
    await openInterval(supabase, {
      tenantId,
      timeEntryId: entry.id,
      phase: 'pause',
      startedAt: new Date(pauseStart),
    });
    return loadEntryIntervals(supabase, entry.id);
  }

  if (entry.lunch_start && entry.lunch_end) {
    pauses.push({
      start: workDateToIso(workDate, entry.lunch_start),
      end: workDateToIso(workDate, entry.lunch_end),
      type: 'lunch',
    });
  } else if (entry.lunch_start && !entry.lunch_end) {
    if (!entry.breakfast_start || entry.breakfast_end) {
      const pauseStart = workDateToIso(workDate, entry.lunch_start);
      if (Date.parse(pauseStart) > Date.parse(dayStart)) {
        await insertClosed('work', dayStart, pauseStart);
      }
      await openInterval(supabase, {
        tenantId,
        timeEntryId: entry.id,
        phase: 'pause',
        startedAt: new Date(pauseStart),
      });
      return loadEntryIntervals(supabase, entry.id);
    }
  }

  pauses.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  if (pauses.length === 0) {
    if (entry.end_time) {
      await insertClosed('work', dayStart, workDateToIso(workDate, entry.end_time));
      return loadEntryIntervals(supabase, entry.id);
    }
    await openInterval(supabase, {
      tenantId,
      timeEntryId: entry.id,
      phase: 'work',
      startedAt: new Date(dayStart),
    });
    return loadEntryIntervals(supabase, entry.id);
  }

  let cursor = dayStart;
  for (const pause of pauses) {
    if (Date.parse(pause.start) > Date.parse(cursor)) {
      await insertClosed('work', cursor, pause.start);
    }
    await insertClosed('pause', pause.start, pause.end, pause.type);
    cursor = pause.end;
  }

  if (entry.end_time) {
    const dayEnd = workDateToIso(workDate, entry.end_time);
    if (Date.parse(dayEnd) > Date.parse(cursor)) {
      await insertClosed('work', cursor, dayEnd);
    }
    return loadEntryIntervals(supabase, entry.id);
  }

  await openInterval(supabase, {
    tenantId,
    timeEntryId: entry.id,
    phase: 'work',
    startedAt: new Date(cursor),
  });
  return loadEntryIntervals(supabase, entry.id);
}
