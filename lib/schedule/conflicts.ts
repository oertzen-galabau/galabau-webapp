import { addDays, dateInRange, parseIsoDate } from '@/lib/schedule/week';

export type ScheduleSlot = {
  entryId: string;
  userId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

export type ScheduleEquipmentSlot = {
  entryId: string;
  equipmentId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

export type ScheduleConflict = {
  entryIds: [string, string];
  date: string;
  kind: 'person' | 'equipment';
};

export type LeaveDay = {
  userId: string;
  date: string;
  leaveType: string;
};

function timeToMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  return as < be && bs < ae;
}

function eachDayInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function findOverlappingEntryPairs(
  grouped: Map<string, { entryId: string; startDate: string; endDate: string; startTime: string; endTime: string }[]>,
): { entryIds: [string, string]; date: string }[] {
  const conflicts: { entryIds: [string, string]; date: string }[] = [];
  for (const groupSlots of grouped.values()) {
    for (let i = 0; i < groupSlots.length; i++) {
      for (let j = i + 1; j < groupSlots.length; j++) {
        const a = groupSlots[i];
        const b = groupSlots[j];
        const daysA = eachDayInRange(a.startDate, a.endDate);
        const daysB = new Set(eachDayInRange(b.startDate, b.endDate));
        for (const day of daysA) {
          if (!daysB.has(day)) continue;
          if (timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
            conflicts.push({ entryIds: [a.entryId, b.entryId], date: day });
          }
        }
      }
    }
  }
  return conflicts;
}

export function findTimeConflicts(slots: ScheduleSlot[]): ScheduleConflict[] {
  const byUser = new Map<string, ScheduleSlot[]>();
  for (const s of slots) {
    const list = byUser.get(s.userId) ?? [];
    list.push(s);
    byUser.set(s.userId, list);
  }
  return findOverlappingEntryPairs(byUser).map((c) => ({ ...c, kind: 'person' as const }));
}

export function findEquipmentConflicts(slots: ScheduleEquipmentSlot[]): ScheduleConflict[] {
  const byEquipment = new Map<string, ScheduleEquipmentSlot[]>();
  for (const s of slots) {
    const list = byEquipment.get(s.equipmentId) ?? [];
    list.push(s);
    byEquipment.set(s.equipmentId, list);
  }
  return findOverlappingEntryPairs(byEquipment).map((c) => ({ ...c, kind: 'equipment' as const }));
}

export function scheduleConflictEntryIds(conflicts: ScheduleConflict[]): Set<string> {
  const ids = new Set<string>();
  for (const c of conflicts) {
    ids.add(c.entryIds[0]);
    ids.add(c.entryIds[1]);
  }
  return ids;
}

export function leaveOnDate(leaves: LeaveDay[], userId: string, date: string): LeaveDay | undefined {
  return leaves.find((l) => l.userId === userId && l.date === date);
}

export function expandLeaveRequests(
  rows: { user_id: string; start_date: string; end_date: string; leave_type: string; status: string }[],
): LeaveDay[] {
  const out: LeaveDay[] = [];
  for (const row of rows) {
    if (row.status !== 'approved') continue;
    let cur = row.start_date;
    while (cur <= row.end_date) {
      out.push({ userId: row.user_id, date: cur, leaveType: row.leave_type });
      cur = addDays(cur, 1);
    }
  }
  return out;
}

export function entrySpansDay(entry: { start_date: string; end_date: string }, day: string): boolean {
  return dateInRange(day, entry.start_date, entry.end_date);
}

export function dayIndexInWeek(weekStart: string, day: string): number {
  const start = parseIsoDate(weekStart).getTime();
  const d = parseIsoDate(day).getTime();
  return Math.round((d - start) / (86400000));
}
