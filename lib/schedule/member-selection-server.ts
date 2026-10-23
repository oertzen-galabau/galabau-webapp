import type { SupabaseClient } from '@supabase/supabase-js';
import { expandLeaveRequests } from '@/lib/schedule/conflicts';
import {
  assertEmployeesSelectableForSchedule,
  type ScheduleEmployeePick,
  type ScheduleWorkAreaPick,
} from '@/lib/schedule/employee-filter';

async function loadValidationData(
  supabase: SupabaseClient,
  tenantId: string,
  planDates: string[],
): Promise<{
  employees: ScheduleEmployeePick[];
  workAreas: ScheduleWorkAreaPick[];
  leaveDays: ReturnType<typeof expandLeaveRequests>;
}> {
  const sorted = [...planDates].filter(Boolean).sort();
  const minDate = sorted[0] ?? '';
  const maxDate = sorted[sorted.length - 1] ?? minDate;

  const [{ data: employees }, { data: workAreas }, { data: leaveRows }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, first_name, last_name, work_area_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
    supabase
      .from('tenant_work_areas')
      .select('id, name, is_active, schedule_assignable')
      .eq('tenant_id', tenantId),
    minDate && maxDate
      ? supabase
          .from('leave_requests')
          .select('user_id, start_date, end_date, leave_type, status')
          .eq('tenant_id', tenantId)
          .eq('status', 'approved')
          .lte('start_date', maxDate)
          .gte('end_date', minDate)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const leaveRowsList = leaveRows ?? [];

  return {
    employees: (employees ?? []) as ScheduleEmployeePick[],
    workAreas: (workAreas ?? []) as ScheduleWorkAreaPick[],
    leaveDays: expandLeaveRequests(leaveRowsList),
  };
}

export async function assertNewScheduleMembersAllowed(
  supabase: SupabaseClient,
  tenantId: string,
  userIds: string[],
  planDates: string[],
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length || !planDates.length) return;

  const { employees, workAreas, leaveDays } = await loadValidationData(supabase, tenantId, planDates);
  assertEmployeesSelectableForSchedule(employees, unique, workAreas, planDates, leaveDays);
}

export async function assertScheduleMemberUpdatesAllowed(
  supabase: SupabaseClient,
  tenantId: string,
  submittedMemberIds: string[],
  foremanId: string | null,
  previousMemberIds: Set<string>,
  previousForemanId: string | null,
  planDates: string[],
): Promise<void> {
  const newlyAdded = submittedMemberIds.filter((id) => !previousMemberIds.has(id));
  const toValidate = [...new Set(newlyAdded)];
  if (foremanId && foremanId !== previousForemanId) {
    toValidate.push(foremanId);
  }
  await assertNewScheduleMembersAllowed(supabase, tenantId, toValidate, planDates);
}
