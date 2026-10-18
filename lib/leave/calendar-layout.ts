import { dateInRange } from '@/lib/schedule/week';

export type LeaveCalendarRequest = {
  id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
};

export type LeaveCalendarBarLayout = {
  request: LeaveCalendarRequest;
  colStart: number;
  colSpan: number;
  row: number;
};

function clipToMonth(
  startDate: string,
  endDate: string,
  monthDays: string[],
): { start: string; end: string } | null {
  if (monthDays.length === 0) return null;
  const monthStart = monthDays[0]!;
  const monthEnd = monthDays[monthDays.length - 1]!;
  const start = startDate < monthStart ? monthStart : startDate;
  const end = endDate > monthEnd ? monthEnd : endDate;
  if (start > end) return null;
  return { start, end };
}

export function layoutLeaveBarsForUser(
  requests: LeaveCalendarRequest[],
  monthDays: string[],
): LeaveCalendarBarLayout[] {
  const sorted = [...requests].sort(
    (a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date),
  );
  const occupied: boolean[][] = [];
  const result: LeaveCalendarBarLayout[] = [];

  for (const request of sorted) {
    const clipped = clipToMonth(request.start_date, request.end_date, monthDays);
    if (!clipped) continue;

    let colStart = -1;
    let colEnd = -1;
    monthDays.forEach((day, idx) => {
      if (dateInRange(day, clipped.start, clipped.end)) {
        if (colStart < 0) colStart = idx;
        colEnd = idx;
      }
    });
    if (colStart < 0 || colEnd < colStart) continue;
    const colSpan = colEnd - colStart + 1;

    let row = 0;
    while (true) {
      if (!occupied[row]) occupied[row] = Array(monthDays.length).fill(false);
      let fits = true;
      for (let c = colStart; c <= colEnd; c++) {
        if (occupied[row]![c]) {
          fits = false;
          break;
        }
      }
      if (fits) {
        for (let c = colStart; c <= colEnd; c++) occupied[row]![c] = true;
        result.push({ request, colStart, colSpan, row });
        break;
      }
      row += 1;
    }
  }

  return result;
}

export function filterEmployeesBySearchAndArea<
  T extends {
    id: string;
    first_name: string;
    last_name: string;
    work_area_id: string | null;
  },
>(
  employees: T[],
  search: string,
  workAreaId: string | null,
  leaveTypeFilter: string | null,
  requestsByUser: Map<string, LeaveCalendarRequest[]>,
): T[] {
  const q = search.trim().toLowerCase();
  return employees.filter((emp) => {
    if (workAreaId && emp.work_area_id !== workAreaId) return false;
    if (q) {
      const hay = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (leaveTypeFilter) {
      const reqs = requestsByUser.get(emp.id) ?? [];
      const matches = reqs.some((r) => r.leave_type === leaveTypeFilter);
      if (!matches) return false;
    }
    return true;
  });
}
