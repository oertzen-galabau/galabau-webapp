import type { FeedbackReportListRow } from '@/lib/actions/feedback';
import type { FeedbackReportPriority } from '@/lib/types/database';

const PRIORITY_RANK: Record<FeedbackReportPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export function sortFeedbackKanbanRows(a: FeedbackReportListRow, b: FeedbackReportListRow): number {
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}
