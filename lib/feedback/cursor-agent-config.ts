import {
  DEFAULT_DAILY_AGENT_LIMIT,
  DEFAULT_MIN_BUG_DESCRIPTION_LENGTH,
} from '@/lib/feedback/cursor-agent-triage';

export function getCursorAutomationWebhookUrl(): string | null {
  const url = process.env.CURSOR_AUTOMATION_WEBHOOK_URL?.trim();
  return url || null;
}

export function getCursorAutomationWebhookToken(): string | null {
  const token = process.env.CURSOR_AUTOMATION_WEBHOOK_TOKEN?.trim();
  return token || null;
}

export function getCursorAgentMinDescriptionLength(): number {
  const raw = process.env.CURSOR_AGENT_MIN_DESCRIPTION_LENGTH?.trim();
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_MIN_BUG_DESCRIPTION_LENGTH;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MIN_BUG_DESCRIPTION_LENGTH;
}

export function getCursorAgentDailyLimit(): number {
  const raw = process.env.CURSOR_AGENT_DAILY_LIMIT?.trim();
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_DAILY_AGENT_LIMIT;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_AGENT_LIMIT;
}

export function isCursorAgentWebhookConfigured(): boolean {
  return Boolean(getCursorAutomationWebhookUrl() && getCursorAutomationWebhookToken());
}
