import type { TimeEntryApprovalStatus } from '@/lib/types/database';

export function timeEntryStatusLabel(
  approvalStatus: TimeEntryApprovalStatus | null,
  hasEndTime: boolean,
): string {
  if (!hasEndTime) return 'Offen';
  switch (approvalStatus) {
    case 'pending':
      return 'In Prüfung';
    case 'approved':
      return 'Genehmigt';
    case 'rejected':
      return 'Abgelehnt';
    default:
      return 'Offen';
  }
}

export function timeEntryStatusBadgeClass(
  approvalStatus: TimeEntryApprovalStatus | null,
  hasEndTime: boolean,
): string {
  if (!hasEndTime) return '';
  switch (approvalStatus) {
    case 'pending':
      return 'travel';
    case 'approved':
      return 'active';
    case 'rejected':
      return 'danger';
    default:
      return '';
  }
}
