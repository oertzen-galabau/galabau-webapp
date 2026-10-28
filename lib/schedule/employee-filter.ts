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
  if (!employee.work_area_id) return true;
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

export type ScheduleEmployeeSelectionIssue = 'non_assignable_area' | 'absent';

export function scheduleEmployeeSelectionIssue(
  employee: ScheduleEmployeePick,
  workAreas: ScheduleWorkAreaPick[],
  planDates: string[],
  leaveDays: LeaveDay[],
): ScheduleEmployeeSelectionIssue | null {
  if (
    employee.work_area_id &&
    !assignableWorkAreaIds(workAreas).has(employee.work_area_id)
  ) {
    return 'non_assignable_area';
  }
  if (planDates.length && isAbsentOnAnyPlanDate(employee.id, planDates, leaveDays)) return 'absent';
  return null;
}

export function scheduleEmployeeSelectionErrorMessage(
  name: string,
  issue: ScheduleEmployeeSelectionIssue,
): string {
  switch (issue) {
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
      if (e.work_area_id && !assignableIds.has(e.work_area_id)) return false;
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

export const SCHEDULE_NO_WORK_AREA_GROUP_KEY = '__none__';

export type ScheduleEmployeePickerGroup = {
  key: string;
  label: string;
  employees: ScheduleEmployeePick[];
};

/** Gruppiert gefilterte Mitarbeiter nach Berufsbereich (inkl. „Ohne Bereich“). */
export function groupScheduleEmployeesForPicker(
  employees: ScheduleEmployeePick[],
  workAreas: ScheduleWorkAreaPick[],
): ScheduleEmployeePickerGroup[] {
  const assignableIds = assignableWorkAreaIds(workAreas);
  const groups: ScheduleEmployeePickerGroup[] = [];
  const byArea = new Map<string, ScheduleEmployeePick[]>();

  for (const employee of employees) {
    const key = employee.work_area_id ?? SCHEDULE_NO_WORK_AREA_GROUP_KEY;
    const list = byArea.get(key) ?? [];
    list.push(employee);
    byArea.set(key, list);
  }

  const assignableAreas = workAreas
    .filter((a) => a.is_active && assignableIds.has(a.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  for (const area of assignableAreas) {
    const list = byArea.get(area.id);
    if (!list?.length) continue;
    list.sort((a, b) => employeeDisplayName(a).localeCompare(employeeDisplayName(b), 'de'));
    groups.push({ key: area.id, label: area.name, employees: list });
  }

  const noArea = byArea.get(SCHEDULE_NO_WORK_AREA_GROUP_KEY);
  if (noArea?.length) {
    noArea.sort((a, b) => employeeDisplayName(a).localeCompare(employeeDisplayName(b), 'de'));
    groups.push({ key: SCHEDULE_NO_WORK_AREA_GROUP_KEY, label: 'Ohne Bereich', employees: noArea });
  }

  return groups;
}
