import { getDefaultMailRecipient, sendMail } from '@/lib/email/smtp';
import { getPlatformName, getRootDomain } from '@/lib/tenant/config';
import type { FeedbackReportKind } from '@/lib/types/database';

function superadminAppUrl() {
  const root = getRootDomain();
  const rootHost = root.split(':')[0];
  const port = root.includes(':') ? `:${root.split(':')[1]}` : '';
  if (rootHost === 'localhost') {
    return `http://localhost${port}/superadmin`;
  }
  return `https://${rootHost}${port}/superadmin`;
}

function kindLabel(kind: FeedbackReportKind) {
  return kind === 'bug' ? 'Bug' : 'Feedback';
}

export async function sendFeedbackReportNotification(input: {
  kind: FeedbackReportKind;
  title: string;
  description: string;
  tenantName: string;
  userName: string;
  userEmail: string;
  pageUrl: string | null;
}) {
  const to = getDefaultMailRecipient();
  if (!to) return;

  const platform = getPlatformName();
  const subject = `[${platform}] ${kindLabel(input.kind)}: ${input.title}`;
  const link = superadminAppUrl();
  const lines = [
    `Neue ${kindLabel(input.kind)}-Meldung`,
    '',
    `Mandant: ${input.tenantName}`,
    `Nutzer: ${input.userName} (${input.userEmail})`,
    `Titel: ${input.title}`,
    '',
    input.description,
    '',
    input.pageUrl ? `Seite: ${input.pageUrl}` : null,
    '',
    `Superadmin: ${link}`,
  ].filter((line): line is string => line !== null);

  try {
    await sendMail({
      to,
      subject,
      text: lines.join('\n'),
      replyTo: input.userEmail,
    });
  } catch (err) {
    console.warn('[feedback] notification email failed:', err instanceof Error ? err.message : err);
  }
}
