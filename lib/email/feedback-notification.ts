import {
  buildTransactionalMailHtml,
  escapeHtml,
  mailCtaButtonHtml,
} from '@/lib/email/mail-template';
import { getDefaultMailRecipient, sendMail } from '@/lib/email/smtp';
import { feedbackKindLabel } from '@/lib/feedback/labels';
import { getPlatformName, getRootDomain } from '@/lib/tenant/config';
import type { FeedbackReportKind, FeedbackReportStatus } from '@/lib/types/database';

function superadminAppUrl() {
  const root = getRootDomain();
  const rootHost = root.split(':')[0];
  const port = root.includes(':') ? `:${root.split(':')[1]}` : '';
  if (rootHost === 'localhost') {
    return `http://localhost${port}/superadmin?tab=feedback`;
  }
  return `https://${rootHost}${port}/superadmin?tab=feedback`;
}

/** True when status moves into done (not when already done). */
export function shouldNotifyFeedbackOwnerOnDone(
  previousStatus: FeedbackReportStatus,
  nextStatus: FeedbackReportStatus,
) {
  return previousStatus !== 'done' && nextStatus === 'done';
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
  const subject = `[${platform}] ${feedbackKindLabel(input.kind)}: ${input.title}`;
  const link = superadminAppUrl();
  const lines = [
    `Neue ${feedbackKindLabel(input.kind)}-Meldung`,
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

export async function sendFeedbackDoneToOwnerNotification(input: {
  to: string;
  firstName: string;
  kind: FeedbackReportKind;
  title: string;
  boardUrl: string;
  publicReply?: string | null;
}) {
  if (!input.to.trim()) return;

  const platform = getPlatformName();
  const kind = feedbackKindLabel(input.kind);
  const greeting = input.firstName.trim() ? `Hallo ${input.firstName.trim()},` : 'Hallo,';
  const reply = input.publicReply?.trim() || '';
  const subject = `[${platform}] Erledigt: ${input.title}`;
  const text = [
    greeting,
    '',
    `Ihre ${kind}-Meldung „${input.title}“ wurde als erledigt markiert.`,
    reply ? '' : null,
    reply ? `Antwort: ${reply}` : null,
    '',
    `Offene Tasks: ${input.boardUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const sections = [
    reply
      ? `<tr><td style="padding:4px 24px 16px; font-size:15px; line-height:1.55; color:#3f3f46;"><strong>Antwort</strong><br />${escapeHtml(reply).replace(/\n/g, '<br />')}</td></tr>`
      : null,
    mailCtaButtonHtml(input.boardUrl, 'Zum Task-Board'),
  ].filter((s): s is string => Boolean(s));

  const html = buildTransactionalMailHtml({
    platformName: platform,
    title: 'Meldung erledigt',
    leadParagraph: `${greeting} Ihre ${kind}-Meldung „${input.title}“ wurde als erledigt markiert.`,
    sections,
  });

  try {
    await sendMail({ to: input.to, subject, text, html });
  } catch (err) {
    console.warn('[feedback] done email failed:', err instanceof Error ? err.message : err);
  }
}
