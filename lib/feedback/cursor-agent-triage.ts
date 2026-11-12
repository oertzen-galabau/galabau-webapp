import type { FeedbackReportKind } from '@/lib/types/database';

export const CURSOR_AGENT_STARTED_MARKER = 'KI-Agent gestartet';

export const DEFAULT_MIN_BUG_DESCRIPTION_LENGTH = 40;
export const DEFAULT_DAILY_AGENT_LIMIT = 5;

export type CursorAgentTriageInput = {
  kind: FeedbackReportKind;
  title: string;
  description: string;
  webhookConfigured: boolean;
  startsToday: number;
  dailyLimit: number;
  minDescriptionLength: number;
};

export type CursorAgentTriageSkipReason =
  | 'not_bug'
  | 'title_empty'
  | 'description_too_short'
  | 'webhook_not_configured'
  | 'daily_limit';

export function triageCursorAgentTrigger(
  input: CursorAgentTriageInput,
): { ok: true } | { ok: false; reason: CursorAgentTriageSkipReason } {
  if (input.kind !== 'bug') return { ok: false, reason: 'not_bug' };
  if (!input.title.trim()) return { ok: false, reason: 'title_empty' };
  if (input.description.trim().length < input.minDescriptionLength) {
    return { ok: false, reason: 'description_too_short' };
  }
  if (!input.webhookConfigured) return { ok: false, reason: 'webhook_not_configured' };
  if (input.startsToday >= input.dailyLimit) return { ok: false, reason: 'daily_limit' };
  return { ok: true };
}
