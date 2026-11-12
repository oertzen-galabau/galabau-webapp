import {
  getCursorAgentDailyLimit,
  getCursorAgentMinDescriptionLength,
  isCursorAgentWebhookConfigured,
} from '@/lib/feedback/cursor-agent-config';
import {
  CURSOR_AGENT_STARTED_MARKER,
  triageCursorAgentTrigger,
} from '@/lib/feedback/cursor-agent-triage';
import { postCursorAutomationWebhook } from '@/lib/feedback/cursor-agent-webhook';
import { sendCursorAgentStartedNotification } from '@/lib/email/cursor-agent-notification';
import { appendInternalNote } from '@/lib/feedback/internal-note';
import { createAdminClient } from '@/lib/supabase/admin';
import type { FeedbackReportKind } from '@/lib/types/database';

function startOfUtcDayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function countAgentStartsToday(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const { count, error } = await admin
    .from('feedback_reports')
    .select('id', { count: 'exact', head: true })
    .gte('updated_at', startOfUtcDayIso())
    .ilike('internal_note', `%${CURSOR_AGENT_STARTED_MARKER}%`);

  if (error) {
    console.warn('[cursor-agent] daily count failed:', error.message);
    return Number.MAX_SAFE_INTEGER;
  }
  return count ?? 0;
}

export function triggerCursorAgentForFeedbackReport(input: {
  reportId: string;
  kind: FeedbackReportKind;
  title: string;
  description: string;
  pageUrl: string | null;
  tenantName: string;
}): void {
  void (async () => {
    try {
      const webhookConfigured = isCursorAgentWebhookConfigured();
      const admin = createAdminClient();
      const startsToday = webhookConfigured ? await countAgentStartsToday(admin) : 0;

      const triage = triageCursorAgentTrigger({
        kind: input.kind,
        title: input.title,
        description: input.description,
        webhookConfigured,
        startsToday,
        dailyLimit: getCursorAgentDailyLimit(),
        minDescriptionLength: getCursorAgentMinDescriptionLength(),
      });

      if (!triage.ok) {
        if (triage.reason !== 'webhook_not_configured') {
          console.info('[cursor-agent] skipped', input.reportId, triage.reason);
        }
        return;
      }

      const { data: report, error: loadError } = await admin
        .from('feedback_reports')
        .select('internal_note')
        .eq('id', input.reportId)
        .maybeSingle();

      if (loadError || !report) {
        console.warn('[cursor-agent] load failed:', loadError?.message ?? 'missing');
        return;
      }

      let internal_note: string;
      try {
        internal_note = appendInternalNote(report.internal_note, CURSOR_AGENT_STARTED_MARKER);
      } catch (err) {
        console.warn('[cursor-agent] note append failed:', err instanceof Error ? err.message : err);
        return;
      }

      const { error: updateError } = await admin
        .from('feedback_reports')
        .update({
          status: 'in_progress',
          internal_note,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.reportId);

      if (updateError) {
        console.warn('[cursor-agent] status update failed:', updateError.message);
        return;
      }

      await postCursorAutomationWebhook({
        report_id: input.reportId,
        kind: 'bug',
        title: input.title,
        description: input.description,
        page_url: input.pageUrl,
        tenant_name: input.tenantName,
      });

      void sendCursorAgentStartedNotification({
        reportId: input.reportId,
        title: input.title,
        tenantName: input.tenantName,
      });
    } catch (err) {
      console.warn('[cursor-agent] trigger failed:', err instanceof Error ? err.message : err);
    }
  })();
}
