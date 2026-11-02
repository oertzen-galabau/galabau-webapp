import type { SupabaseClient } from '@supabase/supabase-js';
import type { TimeBlockType, TimeEntryInterval, TimeEntryIntervalPhase } from '@/lib/types/database';

export async function loadEntryIntervals(
  supabase: SupabaseClient,
  timeEntryId: string,
): Promise<TimeEntryInterval[]> {
  const { data, error } = await supabase
    .from('time_entry_intervals')
    .select('*')
    .eq('time_entry_id', timeEntryId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TimeEntryInterval[];
}

export function getOpenInterval(intervals: TimeEntryInterval[]): TimeEntryInterval | null {
  return intervals.find((row) => row.ended_at == null) ?? null;
}

export function derivePhaseFromIntervals(
  intervals: TimeEntryInterval[],
  hasEndTime: boolean,
  hasStartTime: boolean,
): 'idle' | 'working' | 'paused' | 'finished' {
  if (!hasStartTime) return 'idle';
  if (hasEndTime) return 'finished';
  const open = getOpenInterval(intervals);
  if (open?.phase === 'pause') return 'paused';
  return 'working';
}

export function computeWorkSecondsFromIntervals(
  intervals: TimeEntryInterval[],
  nowMs: number,
): number {
  let total = 0;
  for (const row of intervals) {
    if (row.phase !== 'work') continue;
    const start = Date.parse(row.started_at);
    if (Number.isNaN(start)) continue;
    const end = row.ended_at ? Date.parse(row.ended_at) : nowMs;
    if (Number.isNaN(end) || end <= start) continue;
    total += Math.floor((end - start) / 1000);
  }
  return Math.max(0, total);
}

export async function nextSortOrder(
  supabase: SupabaseClient,
  timeEntryId: string,
): Promise<number> {
  const { data } = await supabase
    .from('time_entry_intervals')
    .select('sort_order')
    .eq('time_entry_id', timeEntryId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sort_order ?? -1) + 1;
}

export async function openInterval(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    timeEntryId: string;
    phase: TimeEntryIntervalPhase;
    startedAt?: Date;
    sortOrder?: number;
    /** Nach closeOpenInterval — spart eine DB-Abfrage. */
    trustNoOpenInterval?: boolean;
  },
): Promise<TimeEntryInterval> {
  if (!params.trustNoOpenInterval) {
    const open = await supabase
      .from('time_entry_intervals')
      .select('id')
      .eq('time_entry_id', params.timeEntryId)
      .is('ended_at', null)
      .maybeSingle();
    if (open.data) throw new Error('Es läuft bereits ein offenes Intervall.');
  }

  const sort_order =
    params.sortOrder ?? (await nextSortOrder(supabase, params.timeEntryId));
  const started_at = (params.startedAt ?? new Date()).toISOString();
  const { data, error } = await supabase
    .from('time_entry_intervals')
    .insert({
      tenant_id: params.tenantId,
      time_entry_id: params.timeEntryId,
      sort_order,
      phase: params.phase,
      started_at,
      ended_at: null,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Intervall konnte nicht gestartet werden.');
  return data as TimeEntryInterval;
}

export async function closeIntervalById(
  supabase: SupabaseClient,
  intervalId: string,
  endedAt?: Date,
): Promise<TimeEntryInterval> {
  const ended_at = (endedAt ?? new Date()).toISOString();
  const { data, error } = await supabase
    .from('time_entry_intervals')
    .update({ ended_at })
    .eq('id', intervalId)
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Intervall konnte nicht beendet werden.');
  return data as TimeEntryInterval;
}

export async function closeOpenInterval(
  supabase: SupabaseClient,
  timeEntryId: string,
  endedAt?: Date,
): Promise<TimeEntryInterval> {
  const { data: open, error: loadError } = await supabase
    .from('time_entry_intervals')
    .select('*')
    .eq('time_entry_id', timeEntryId)
    .is('ended_at', null)
    .maybeSingle();
  if (loadError) throw new Error(loadError.message);
  if (!open) throw new Error('Kein offenes Intervall.');

  const ended_at = (endedAt ?? new Date()).toISOString();
  const { data, error } = await supabase
    .from('time_entry_intervals')
    .update({ ended_at })
    .eq('id', open.id)
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Intervall konnte nicht beendet werden.');
  return data as TimeEntryInterval;
}

export async function updateIntervalSuggestion(
  supabase: SupabaseClient,
  intervalId: string,
  suggested: TimeBlockType,
): Promise<void> {
  const { error } = await supabase
    .from('time_entry_intervals')
    .update({ suggested_block_type: suggested })
    .eq('id', intervalId);
  if (error) throw new Error(error.message);
}

export async function confirmIntervalType(
  supabase: SupabaseClient,
  intervalId: string,
  blockType: TimeBlockType,
): Promise<void> {
  const { error } = await supabase
    .from('time_entry_intervals')
    .update({
      confirmed_block_type: blockType,
      suggested_block_type: blockType,
    })
    .eq('id', intervalId);
  if (error) throw new Error(error.message);
}

export function pauseIntervalsNeedConfirmation(intervals: TimeEntryInterval[]): TimeEntryInterval[] {
  return intervals.filter(
    (row) => row.phase === 'pause' && row.ended_at != null && row.confirmed_block_type == null,
  );
}
