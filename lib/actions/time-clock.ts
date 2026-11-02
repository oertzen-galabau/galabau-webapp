'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import type { PermissionKey } from '@/lib/auth/permissions';
import { loadTenantTimeTrackingRules } from '@/lib/time-tracking/break-rules';
import { todayWorkDate, toTimeString } from '@/lib/time-tracking/work-day';
import { confirmPauseIntervalsForUser } from '@/lib/time-tracking/confirm-pause-intervals';
import {
  closeIntervalById,
  getOpenInterval,
  loadEntryIntervals,
  openInterval,
  updateIntervalSuggestion,
} from '@/lib/time-tracking/intervals';
import { suggestPauseBlockType } from '@/lib/time-tracking/interval-suggest';
import {
  assertLiveState,
  getOpenEntryForClock,
  getTodayEntry,
} from '@/lib/time-tracking/clock-entry-session';
import {
  EARLY_START_REASON_MIN_LENGTH,
  getPlannedDayStartForUser,
  isStartBeforePlannedWithTolerance,
} from '@/lib/schedule/planned-day-start';
import type { TimeBlockType, TimeEntry, TimeEntryInterval } from '@/lib/types/database';
import type { PauseEndConfirmPrompt } from '@/lib/time-tracking/pause-confirm-prompt';

export type { PauseEndConfirmPrompt } from '@/lib/time-tracking/pause-confirm-prompt';

export type LiveClockSnapshot = {
  entry: TimeEntry;
  intervals: TimeEntryInterval[];
};

export type ClockPauseEndResult = {
  snapshot: LiveClockSnapshot;
  confirmPrompt: PauseEndConfirmPrompt | null;
};

async function snapshotOpenEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entry: TimeEntry,
): Promise<LiveClockSnapshot> {
  const intervals = await loadEntryIntervals(supabase, entry.id);
  return { entry, intervals };
}

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

function revalidateTimePaths() {
  revalidatePath('/app', 'layout');
  revalidatePath('/app/zeiten');
  revalidatePath('/app/zeiten/freigabe');
}

function revalidateLiveClock() {
  revalidatePath('/app', 'layout');
}

export async function clockInWork(payload?: {
  earlyStartReason?: string | null;
}): Promise<LiveClockSnapshot> {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const workDate = todayWorkDate();

  const existing = await getTodayEntry(supabase, tenantId, userId, workDate);
  if (existing?.start_time) {
    throw new Error('Für heute existiert bereits ein Zeiteintrag.');
  }

  const rules = await loadTenantTimeTrackingRules(supabase, tenantId);
  const plan = rules.compare_schedule_on_clock_in
    ? await getPlannedDayStartForUser(supabase, tenantId, userId, workDate)
    : null;

  const nowDate = new Date();
  const now = toTimeString(nowDate);

  let earlyStartReason: string | null = null;
  if (plan && rules.compare_schedule_on_clock_in) {
    const early = isStartBeforePlannedWithTolerance(
      now,
      plan.plannedStartTime,
      rules.early_start_tolerance_minutes,
    );
    if (early) {
      const reason = payload?.earlyStartReason?.trim() ?? '';
      if (reason.length < EARLY_START_REASON_MIN_LENGTH) {
        throw new Error(
          `Geplant ab ${plan.plannedStartTime.slice(0, 5)} — bitte einen Grund für den frühen Start angeben (min. ${EARLY_START_REASON_MIN_LENGTH} Zeichen).`,
        );
      }
      earlyStartReason = reason;
    }
  }

  const { data: assignment } = await supabase
    .from('daily_assignments')
    .select('site_id')
    .eq('user_id', userId)
    .eq('assignment_date', workDate)
    .maybeSingle();

  const siteId = plan?.siteId ?? assignment?.site_id ?? null;

  const { data: inserted, error } = await supabase
    .from('time_entries')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      site_id: siteId,
      work_date: workDate,
      start_time: now,
      end_time: null,
      travel_minutes: 0,
      work_minutes: 0,
      planned_start_time: plan?.plannedStartTime ?? null,
      schedule_entry_id: plan?.scheduleEntryId ?? null,
      early_start_reason: earlyStartReason,
    })
    .select('*')
    .single();
  if (error || !inserted) throw new Error(error?.message ?? 'Start fehlgeschlagen.');

  await openInterval(supabase, {
    tenantId,
    timeEntryId: inserted.id,
    phase: 'work',
    startedAt: nowDate,
    trustNoOpenInterval: true,
  });

  revalidateTimePaths();
  return snapshotOpenEntry(supabase, inserted as TimeEntry);
}

export async function clockPauseStart(): Promise<LiveClockSnapshot> {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const workDate = todayWorkDate();
  const { entry, intervals } = await getOpenEntryForClock(supabase, tenantId, userId, workDate);
  assertLiveState(entry, intervals, ['working']);

  const openWork = getOpenInterval(intervals);
  if (!openWork) throw new Error('Kein offenes Arbeitsintervall.');

  await closeIntervalById(supabase, openWork.id);
  await openInterval(supabase, {
    tenantId,
    timeEntryId: entry!.id,
    phase: 'pause',
    sortOrder: intervals.length,
    trustNoOpenInterval: true,
  });

  revalidateLiveClock();
  return snapshotOpenEntry(supabase, entry as TimeEntry);
}

export async function clockPauseEnd(): Promise<ClockPauseEndResult> {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const workDate = todayWorkDate();
  const { entry, intervals } = await getOpenEntryForClock(supabase, tenantId, userId, workDate);
  assertLiveState(entry, intervals, ['paused', 'breakfast', 'lunch']);

  const openPause = getOpenInterval(intervals);
  if (!openPause) throw new Error('Kein offenes Pausenintervall.');

  const closedPause = await closeIntervalById(supabase, openPause.id);

  let confirmPrompt: PauseEndConfirmPrompt | null = null;

  if (closedPause.phase === 'pause' && closedPause.ended_at) {
    const rules = await loadTenantTimeTrackingRules(supabase, tenantId);
    const pauseIndex = intervals.filter((row) => row.phase === 'pause' && row.ended_at).length;
    const dayStartIso = `${entry!.work_date}T${entry!.start_time!.slice(0, 8)}`;
    const suggestion = suggestPauseBlockType({
      workDate: entry!.work_date,
      dayStartIso,
      pauseStartedAt: closedPause.started_at,
      pauseEndedAt: closedPause.ended_at,
      pauseIndex,
      rules,
    });
    await updateIntervalSuggestion(supabase, closedPause.id, suggestion.blockType);
    confirmPrompt = {
      intervalId: closedPause.id,
      suggestedBlockType: suggestion.blockType,
      pauseStartedAt: closedPause.started_at,
      pauseEndedAt: closedPause.ended_at,
    };
  }

  await openInterval(supabase, {
    tenantId,
    timeEntryId: entry!.id,
    phase: 'work',
    sortOrder: intervals.length + 1,
    trustNoOpenInterval: true,
  });

  revalidateLiveClock();
  const snapshot = await snapshotOpenEntry(supabase, entry as TimeEntry);
  return { snapshot, confirmPrompt };
}

export async function confirmIntervalType(intervalId: string, blockType: TimeBlockType) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'zeiten.record');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  await confirmPauseIntervalsForUser(supabase, tenantId, userId, [
    { intervalId, blockType },
  ]);
  revalidateLiveClock();
}
