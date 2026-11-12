import { createHmac, timingSafeEqual } from 'node:crypto';
import { sendCursorAgentPrReadyNotification } from '@/lib/email/cursor-agent-notification';
import { appendInternalNote } from '@/lib/feedback/internal-note';
import { createAdminClient } from '@/lib/supabase/admin';

const REPORT_ID_IN_TEXT =
  /\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/i;

export function extractFeedbackReportIdFromPrText(text: string): string | null {
  const match = text.match(REPORT_ID_IN_TEXT);
  return match?.[1]?.toLowerCase() ?? null;
}

export function verifyGithubWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) return false;
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const expected = `sha256=${digest}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

type PullRequestOpenedPayload = {
  action?: string;
  pull_request?: {
    title?: string;
    body?: string | null;
    html_url?: string;
  };
};

export async function handleGithubPullRequestWebhook(
  payload: PullRequestOpenedPayload,
): Promise<{ handled: boolean; reportId?: string }> {
  const pr = payload.pull_request;
  const prUrl = pr?.html_url;
  if (payload.action !== 'opened' || !pr || !prUrl) {
    return { handled: false };
  }

  const reportId =
    extractFeedbackReportIdFromPrText(pr.title ?? '') ??
    extractFeedbackReportIdFromPrText(pr.body ?? '');

  if (!reportId) return { handled: false };

  const admin = createAdminClient();
  const { data: report, error: loadError } = await admin
    .from('feedback_reports')
    .select('id, title, internal_note')
    .eq('id', reportId)
    .maybeSingle();

  if (loadError || !report) {
    console.warn('[github-webhook] report not found:', reportId, loadError?.message);
    return { handled: false };
  }

  if (report.internal_note?.includes(prUrl)) {
    return { handled: true, reportId };
  }

  let internal_note: string;
  try {
    internal_note = appendInternalNote(report.internal_note, `PR: ${prUrl}`);
  } catch (err) {
    console.warn('[github-webhook] note append failed:', err instanceof Error ? err.message : err);
    return { handled: false };
  }

  const { error: updateError } = await admin
    .from('feedback_reports')
    .update({
      internal_note,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  if (updateError) {
    console.warn('[github-webhook] update failed:', updateError.message);
    return { handled: false };
  }

  void sendCursorAgentPrReadyNotification({
    reportId,
    title: report.title,
    prUrl,
  });

  return { handled: true, reportId };
}
