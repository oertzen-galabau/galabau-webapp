import { LEAVE_TYPE_LABELS } from '@/lib/leave/labels';
import { businessDaysBetween } from '@/lib/utils/time';

export type LeaveCalendarViewer = {
  userId: string;
  /** Darf Gründe anderer Mitarbeiter sehen (Genehmigung / alle Anträge). */
  canSeeOthersLeaveReason: boolean;
};

export function calendarLeaveTypeLabel(
  leaveType: string,
  viewer: LeaveCalendarViewer,
  requestUserId: string,
): string {
  const isOwn = requestUserId === viewer.userId;
  if (!isOwn && !viewer.canSeeOthersLeaveReason) {
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
  requestUserId: string,
): string {
  const typeLabel = calendarLeaveTypeLabel(leaveType, viewer, requestUserId);
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
  viewer: LeaveCalendarViewer,
  requestUserId: string,
): 'vacation' | 'school' | 'sensitive' | 'pending' {
  const isOwn = requestUserId === viewer.userId;
  const maskReason = !isOwn && !viewer.canSeeOthersLeaveReason;
  if (status === 'pending') return 'pending';
  if (maskReason) return 'sensitive';
  if (leaveType === 'urlaub') return 'vacation';
  if (leaveType === 'schule') return 'school';
  return 'sensitive';
}
