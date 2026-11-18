import type { SupabaseClient } from '@supabase/supabase-js';
import { loadTenantTimeTrackingRules } from '@/lib/time-tracking/break-rules';
import {
  getPlannedDayStartForUser,
  isEndAfterPlannedEndWithTolerance,
  isStartAfterPlannedEnd,
  isStartBeforePlannedWithTolerance,
} from '@/lib/schedule/planned-day-start';
import { todayWorkDate, toTimeString } from '@/lib/time-tracking/work-day';

export type OutsidePlanReasonVariant = 'early_start' | 'late_start';

export type TodayScheduleContext = {
  plannedStartTime: string | null;
  plannedEndTime: string | null;
  plannedSiteName: string | null;
  earlyStartToleranceMinutes: number;
};

export async function buildTodayScheduleContext(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
): Promise<TodayScheduleContext> {
  const workDate = todayWorkDate();
  const rules = await loadTenantTimeTrackingRules(supabase, tenantId);
  const plan = await getPlannedDayStartForUser(supabase, tenantId, userId, workDate);

  if (!plan) {
    return {
      plannedStartTime: null,
      plannedEndTime: null,
      plannedSiteName: null,
      earlyStartToleranceMinutes: rules.early_start_tolerance_minutes,
    };
  }

  return {
    plannedStartTime: plan.plannedStartTime.slice(0, 5),
    plannedEndTime: plan.plannedEndTime.slice(0, 5),
    plannedSiteName: plan.siteName,
    earlyStartToleranceMinutes: rules.early_start_tolerance_minutes,
  };
}

export function needsEarlyStartReasonNow(
  context: TodayScheduleContext,
  now = new Date(),
): boolean {
  if (!context.plannedStartTime) return false;
  const planned =
    context.plannedStartTime.length <= 5
      ? `${context.plannedStartTime}:00`
      : context.plannedStartTime;
  return isStartBeforePlannedWithTolerance(
    toTimeString(now),
    planned,
    context.earlyStartToleranceMinutes,
  );
}

export function needsLateStartReasonNow(
  context: TodayScheduleContext,
  now = new Date(),
): boolean {
  if (!context.plannedEndTime) return false;
  const plannedEnd =
    context.plannedEndTime.length <= 5
      ? `${context.plannedEndTime}:00`
      : context.plannedEndTime;
  return isStartAfterPlannedEnd(toTimeString(now), plannedEnd);
}

export function outsidePlanReasonVariant(
  context: TodayScheduleContext,
  now = new Date(),
): OutsidePlanReasonVariant | null {
  if (needsEarlyStartReasonNow(context, now)) return 'early_start';
  if (needsLateStartReasonNow(context, now)) return 'late_start';
  return null;
}

export function needsLateEndReasonNow(
  context: TodayScheduleContext,
  endTime: string,
): boolean {
  if (!context.plannedEndTime) return false;
  const plannedEnd =
    context.plannedEndTime.length <= 5
      ? `${context.plannedEndTime}:00`
      : context.plannedEndTime;
  const end = endTime.length <= 5 ? `${endTime}:00` : endTime;
  return isEndAfterPlannedEndWithTolerance(
    end,
    plannedEnd,
    context.earlyStartToleranceMinutes,
  );
}