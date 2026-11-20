import type { TimeEntryApprovalStatus } from '@/lib/types/database';
import { todayWorkDate } from '@/lib/time-tracking/work-day';

export const EDITABLE_DAYS_BACK = 3;

export const DUPLICATE_DAY_ERROR = 'Für diesen Tag existiert bereits ein Zeiteintrag.';

/** Postgres unique_violation (Index time_entries_user_work_date_key) → verständliche Meldung. */
export function timeEntryWriteError(error: { code?: string; message: string }): Error {
  return new Error(error.code === '23505' ? DUPLICATE_DAY_ERROR : error.message);
}

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

/** Freigegeben — keine Bearbeitung/Löschung durch Mitarbeitende. */
export function isOwnSubmittedTimeEntryLocked(entry: EntryLike): boolean {
  return entry.approval_status === 'approved';
}

export function isTimeEntryEditable(entry: EntryLike): boolean {
  if (entry.approval_status === 'approved') return false;
  if (!entry.end_time) return false;
  return entry.approval_status === 'pending' || entry.approval_status === 'rejected';
}

export function isTimeEntryDeletable(entry: EntryLike, today?: string): boolean {
  if (entry.approval_status === 'approved') return false;
  if (entry.end_time && entry.approval_status !== 'rejected') return false;
  return isWithinEditableDateRange(entry.work_date, today);
}
