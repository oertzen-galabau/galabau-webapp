import { LEAVE_TYPE_LABELS } from '@/lib/leave/labels';
import { businessDaysBetween } from '@/lib/utils/time';

const SENSITIVE_LEAVE_TYPES = new Set(['krankheit', 'arzt', 'amt', 'sonstige']);

export type LeaveCalendarViewer = {
  canApprove: boolean;
};

export function calendarLeaveTypeLabel(
  leaveType: string,
  viewer: LeaveCalendarViewer,
): string {
  if (!viewer.canApprove && SENSITIVE_LEAVE_TYPES.has(leaveType)) {
    return 'Abwesend';
  }
  return LEAVE_TYPE_LABELS[leaveType] ?? leaveType;
}

export function calendarBarTitle(
  leaveType: string,
  startDate: string,
  endDate: string,
  status: string,
  viewer: LeaveCalendarViewer,
): string {
  const typeLabel = calendarLeaveTypeLabel(leaveType, viewer);
  const days = businessDaysBetween(startDate, endDate);
  const daysPart = days === 1 ? '1 Tag' : `${days} Tage`;
  if (status === 'pending') {
    return `${typeLabel} (offen) – ${daysPart}`;
  }
  return `${typeLabel} – ${daysPart}`;
}

export function calendarBarTone(
  leaveType: string,
  status: string,
): 'vacation' | 'school' | 'sensitive' | 'pending' {
  if (status === 'pending') return 'pending';
  if (leaveType === 'urlaub') return 'vacation';
  if (leaveType === 'schule') return 'school';
  return 'sensitive';
}
