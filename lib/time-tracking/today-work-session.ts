import type { SupabaseClient } from '@supabase/supabase-js';
import type { TimeEntry, TimeEntryInterval } from '@/lib/types/database';
import { ensureLegacyIntervalsMigrated } from '@/lib/time-tracking/legacy-interval-migrate';
import { loadEntryIntervals } from '@/lib/time-tracking/intervals';

export type TodayWorkSession = {
  entry: TimeEntry | null;
  intervals: TimeEntryInterval[];
};

export type LoadTodayWorkSessionOptions = {
  /** Legacy breakfast/lunch → Intervalle (nur bei Server Actions, nicht im Layout). */
  migrateLegacy?: boolean;
};

export async function loadTodayWorkSession(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  workDate: string,
  options: LoadTodayWorkSessionOptions = {},
): Promise<TodayWorkSession> {
  const { data: entry, error } = await supabase
    .from('time_entries')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('work_date', workDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!entry) return { entry: null, intervals: [] };

  let intervals = await loadEntryIntervals(supabase, entry.id);
  if (
    options.migrateLegacy &&
    entry.start_time &&
    !entry.end_time &&
    intervals.length === 0
  ) {
    intervals = await ensureLegacyIntervalsMigrated(supabase, tenantId, entry);
  }

  return { entry: entry as TimeEntry, intervals };
}
