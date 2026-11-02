import type { SupabaseClient } from '@supabase/supabase-js';
import { loadTenantTimeTrackingRules } from '@/lib/time-tracking/break-rules';
import {
  getPlannedDayStartForUser,
  isStartBeforePlannedWithTolerance,
} from '@/lib/schedule/planned-day-start';
import { todayWorkDate, toTimeString } from '@/lib/time-tracking/work-day';

export type TodayScheduleContext = {
  compareEnabled: boolean;
  plannedStartTime: string | null;
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

  if (!rules.compare_schedule_on_clock_in) {
    return {
      compareEnabled: false,
      plannedStartTime: null,
      plannedSiteName: null,
      earlyStartToleranceMinutes: rules.early_start_tolerance_minutes,
    };
  }

  const plan = await getPlannedDayStartForUser(supabase, tenantId, userId, workDate);
  if (!plan) {
    return {
      compareEnabled: true,
      plannedStartTime: null,
      plannedSiteName: null,
      earlyStartToleranceMinutes: rules.early_start_tolerance_minutes,
    };
  }

  return {
    compareEnabled: true,
    plannedStartTime: plan.plannedStartTime.slice(0, 5),
    plannedSiteName: plan.siteName,
    earlyStartToleranceMinutes: rules.early_start_tolerance_minutes,
  };
}

export function needsEarlyStartReasonNow(
  context: TodayScheduleContext,
  now = new Date(),
): boolean {
  if (!context.compareEnabled || !context.plannedStartTime) return false;
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
