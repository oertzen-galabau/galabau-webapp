import type { SupabaseClient } from '@supabase/supabase-js';
import type { TimeEntryInterval } from '@/lib/types/database';
import { deriveWorkDayState, type TimeEntryLike, type WorkDayState } from '@/lib/time-tracking/work-day';
import { ensureLegacyIntervalsMigrated } from '@/lib/time-tracking/legacy-interval-migrate';
import { loadEntryIntervals } from '@/lib/time-tracking/intervals';

export async function getTodayEntry(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  workDate: string,
) {
  const { data, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('work_date', workDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export function assertLiveState(
  entry: TimeEntryLike | null,
  intervals: TimeEntryInterval[],
  expected: WorkDayState[],
) {
  const state = deriveWorkDayState(entry, intervals);
  if (!expected.includes(state)) {
    throw new Error('Ungültiger Zeiterfassungsstatus für diese Aktion.');
  }
}

/** Schneller Pfad für Stempeluhr-Actions (ohne Layout-Session). */
export async function getOpenEntryForClock(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  workDate: string,
) {
  const entry = await getTodayEntry(supabase, tenantId, userId, workDate);
  if (!entry?.start_time || entry.end_time) {
    return { entry: null as typeof entry, intervals: [] as TimeEntryInterval[] };
  }

  let intervals = await loadEntryIntervals(supabase, entry.id);
  if (intervals.length === 0) {
    intervals = await ensureLegacyIntervalsMigrated(supabase, tenantId, entry);
  }

  return { entry, intervals };
}

export async function getOpenEntryWithIntervals(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  workDate: string,
) {
  return getOpenEntryForClock(supabase, tenantId, userId, workDate);
}
