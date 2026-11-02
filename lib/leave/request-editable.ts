import type { LeaveRequest, LeaveStatus } from '@/lib/types/database';

/** Antrag darf der Mitarbeiter selbst korrigieren (Vertipper vor Freigabe). */
export function employeeCanEditLeaveRequest(req: Pick<LeaveRequest, 'status'>): boolean {
  return req.status === 'pending' || req.status === 'rejected';
}

/** Verwaltung darf offene und genehmigte Anträge korrigieren. */
export function approverCanEditLeaveRequest(req: Pick<LeaveRequest, 'status'>): boolean {
  return req.status === 'pending' || req.status === 'approved';
}

export function canEditLeaveRequest(
  req: Pick<LeaveRequest, 'status'>,
  opts: { isOwner: boolean; canApprove: boolean },
): boolean {
  if (opts.canApprove && approverCanEditLeaveRequest(req)) return true;
  if (opts.isOwner && employeeCanEditLeaveRequest(req)) return true;
  return false;
}

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Offen',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
};
