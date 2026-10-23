import { leaveOnDate, type LeaveDay } from '@/lib/schedule/conflicts';

export type ScheduleEmployeePick = {
  id: string;
  first_name: string;
  last_name: string;
  work_area_id: string | null;
};

export type ScheduleWorkAreaPick = {
  id: string;
  name: string;
  is_active: boolean;
  schedule_assignable: boolean;
};

export type ScheduleEmployeeListFilter = {
  areaId: string | null;
  /** null = alle Bereiche; 'none' = ohne Bereich */
  areaKey: 'all' | 'none' | string;
  searchQuery: string;
  showNonAssignable: boolean;
  planDates?: string[];
  leaveDays?: LeaveDay[];
};

export function normalizeScheduleSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function employeeDisplayName(e: Pick<ScheduleEmployeePick, 'first_name' | 'last_name'>): string {
  return `${e.first_name} ${e.last_name}`.trim();
}

export function assignableWorkAreaIds(workAreas: ScheduleWorkAreaPick[]): Set<string> {
  return new Set(workAreas.filter((a) => a.is_active && a.schedule_assignable).map((a) => a.id));
}

export function isAbsentOnAnyPlanDate(
  userId: string,
  planDates: string[],
  leaveDays: LeaveDay[],
): boolean {
  for (const date of planDates) {
    if (leaveOnDate(leaveDays, userId, date)) return true;
  }
  return false;
}

export function isEmployeeAssignableToSchedule(
  employee: ScheduleEmployeePick,
  workAreas: ScheduleWorkAreaPick[],
): boolean {
  if (!employee.work_area_id) return false;
  return assignableWorkAreaIds(workAreas).has(employee.work_area_id);
}

export function isEmployeeSelectableForSchedule(
  employee: ScheduleEmployeePick,
  workAreas: ScheduleWorkAreaPick[],
  planDates: string[],
  leaveDays: LeaveDay[],
): boolean {
  if (!isEmployeeAssignableToSchedule(employee, workAreas)) return false;
  if (planDates.length && isAbsentOnAnyPlanDate(employee.id, planDates, leaveDays)) return false;
  return true;
}

export type ScheduleEmployeeSelectionIssue = 'no_work_area' | 'non_assignable_area' | 'absent';

export function scheduleEmployeeSelectionIssue(
  employee: ScheduleEmployeePick,
  workAreas: ScheduleWorkAreaPick[],
  planDates: string[],
  leaveDays: LeaveDay[],
): ScheduleEmployeeSelectionIssue | null {
  if (!employee.work_area_id) return 'no_work_area';
  if (!assignableWorkAreaIds(workAreas).has(employee.work_area_id)) return 'non_assignable_area';
  if (planDates.length && isAbsentOnAnyPlanDate(employee.id, planDates, leaveDays)) return 'absent';
  return null;
}

export function scheduleEmployeeSelectionErrorMessage(
  name: string,
  issue: ScheduleEmployeeSelectionIssue,
): string {
  switch (issue) {
    case 'no_work_area':
      return `${name} hat keinen Berufsbereich und kann nicht eingeplant werden.`;
    case 'non_assignable_area':
      return `${name} gehört zu einem Bereich, der nicht für die Einsatzplanung vorgesehen ist.`;
    case 'absent':
      return `${name} ist an mindestens einem gewählten Tag genehmigt abwesend.`;
    default:
      return `${name} kann nicht eingeplant werden.`;
  }
}

export function assertEmployeesSelectableForSchedule(
  employees: ScheduleEmployeePick[],
  userIds: string[],
  workAreas: ScheduleWorkAreaPick[],
  planDates: string[],
  leaveDays: LeaveDay[],
): void {
  const byId = new Map(employees.map((e) => [e.id, e]));
  for (const userId of userIds) {
    const employee = byId.get(userId);
    if (!employee) continue;
    const issue = scheduleEmployeeSelectionIssue(employee, workAreas, planDates, leaveDays);
    if (issue) {
      throw new Error(scheduleEmployeeSelectionErrorMessage(employeeDisplayName(employee), issue));
    }
  }
}

export function filterScheduleEmployeesForPicker(
  employees: ScheduleEmployeePick[],
  workAreas: ScheduleWorkAreaPick[],
  filter: ScheduleEmployeeListFilter,
): ScheduleEmployeePick[] {
  const q = normalizeScheduleSearchQuery(filter.searchQuery);
  const assignableIds = assignableWorkAreaIds(workAreas);
  const planDates = filter.planDates ?? [];
  const leaveDays = filter.leaveDays ?? [];

  return employees.filter((e) => {
    if (!filter.showNonAssignable) {
      if (!e.work_area_id) return false;
      if (!assignableIds.has(e.work_area_id)) return false;
    }

    if (planDates.length && isAbsentOnAnyPlanDate(e.id, planDates, leaveDays)) {
      return false;
    }

    if (filter.areaKey === 'none') {
      if (e.work_area_id) return false;
    } else if (filter.areaKey !== 'all') {
      if (e.work_area_id !== filter.areaKey) return false;
    }

    if (q) {
      const hay = employeeDisplayName(e).toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}
