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
};

export function normalizeScheduleSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function employeeDisplayName(e: Pick<ScheduleEmployeePick, 'first_name' | 'last_name'>): string {
  return `${e.first_name} ${e.last_name}`.trim();
}

export function filterScheduleEmployeesForPicker(
  employees: ScheduleEmployeePick[],
  workAreas: ScheduleWorkAreaPick[],
  filter: ScheduleEmployeeListFilter,
): ScheduleEmployeePick[] {
  const q = normalizeScheduleSearchQuery(filter.searchQuery);
  const assignableIds = new Set(
    workAreas.filter((a) => a.is_active && a.schedule_assignable).map((a) => a.id),
  );

  return employees.filter((e) => {
    if (!filter.showNonAssignable) {
      if (!e.work_area_id) {
        // ohne Bereich weiter anzeigen (einplanbar)
      } else if (!assignableIds.has(e.work_area_id)) {
        return false;
      }
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
