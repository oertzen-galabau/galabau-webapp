import type { FeedbackReportKind, FeedbackReportStatus } from '@/lib/types/database';

/** „Erledigt“ erscheint auf dem öffentlichen Board nur, wenn kürzlich abgeschlossen (Supabase-Vergleich mit timestamptz). */
export const FEEDBACK_BOARD_DONE_RECENT_DAYS = 14;

export type FeedbackBoardMineRow = {
  id: string;
  kind: FeedbackReportKind;
  title: string;
  status: FeedbackReportStatus;
  created_at: string;
  updated_at: string;
};

export type FeedbackBoardPublicRow = {
  id: string;
  kind: FeedbackReportKind;
  title: string;
  status: FeedbackReportStatus;
  updated_at: string;
  /** True, wenn diese Meldung vom aktuellen Nutzer stammt (für Badge „Von mir“). */
  is_mine: boolean;
};

export type FeedbackBoardData = {
  mine: FeedbackBoardMineRow[];
  public: FeedbackBoardPublicRow[];
};
