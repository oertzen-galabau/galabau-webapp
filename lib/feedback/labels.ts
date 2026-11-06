import type {
  FeedbackReportKind,
  FeedbackReportPriority,
  FeedbackReportStatus,
} from '@/lib/types/database';

export function feedbackKindLabel(kind: FeedbackReportKind) {
  return kind === 'bug' ? 'Bug' : 'Feedback';
}

export function feedbackStatusLabel(status: FeedbackReportStatus) {
  if (status === 'open') return 'Offen';
  if (status === 'in_progress') return 'In Arbeit';
  return 'Erledigt';
}

export function feedbackPriorityLabel(priority: FeedbackReportPriority) {
  if (priority === 'low') return 'Niedrig';
  if (priority === 'high') return 'Hoch';
  return 'Normal';
}
