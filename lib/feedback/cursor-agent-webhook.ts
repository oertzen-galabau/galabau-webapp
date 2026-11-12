import {
  getCursorAutomationWebhookToken,
  getCursorAutomationWebhookUrl,
} from '@/lib/feedback/cursor-agent-config';

export type CursorBugWebhookPayload = {
  report_id: string;
  kind: 'bug';
  title: string;
  description: string;
  page_url: string | null;
  tenant_name: string;
};

export async function postCursorAutomationWebhook(payload: CursorBugWebhookPayload): Promise<void> {
  const url = getCursorAutomationWebhookUrl();
  const token = getCursorAutomationWebhookToken();
  if (!url || !token) return;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Cursor webhook ${res.status}: ${body.slice(0, 200)}`);
  }
}
