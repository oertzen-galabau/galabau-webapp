import type { TimeEntryApprovalStatus } from '@/lib/types/database';
import { todayWorkDate } from '@/lib/time-tracking/work-day';

export const EDITABLE_DAYS_BACK = 3;

type EntryLike = {
  approval_status: TimeEntryApprovalStatus | null;
  work_date: string;
  end_time: string | null;
};

export function minEditableWorkDate(today?: string): string {
  const base = today ?? todayWorkDate();
  const [y, m, d] = base.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - EDITABLE_DAYS_BACK);
  return date.toISOString().slice(0, 10);
}

export function isWithinEditableDateRange(workDate: string, today?: string): boolean {
  const t = today ?? todayWorkDate();
  return workDate <= t && workDate >= minEditableWorkDate(t);
}

export function isTimeEntryEditable(entry: EntryLike, today?: string): boolean {
  if (entry.approval_status === 'approved') return false;
  if (!entry.end_time) return false;
  return isWithinEditableDateRange(entry.work_date, today);
}

export function isTimeEntryDeletable(entry: EntryLike, today?: string): boolean {
  if (entry.approval_status === 'approved') return false;
  return isWithinEditableDateRange(entry.work_date, today);
}
