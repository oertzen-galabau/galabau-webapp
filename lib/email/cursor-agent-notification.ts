import { getDefaultMailRecipient, sendMail } from '@/lib/email/smtp';
import { getPlatformName, getRootDomain } from '@/lib/tenant/config';

function superadminFeedbackUrl(reportId: string) {
  const root = getRootDomain();
  const rootHost = root.split(':')[0];
  const port = root.includes(':') ? `:${root.split(':')[1]}` : '';
  const path = `/superadmin?tab=feedback&report=${encodeURIComponent(reportId)}`;
  if (rootHost === 'localhost') {
    return `http://localhost${port}${path}`;
  }
  return `https://${rootHost}${port}${path}`;
}

export async function sendCursorAgentStartedNotification(input: {
  reportId: string;
  title: string;
  tenantName: string;
}) {
  const to = getDefaultMailRecipient();
  if (!to) return;

  const platform = getPlatformName();
  const subject = `[${platform}] KI-Autofix gestartet: ${input.title}`;
  const link = superadminFeedbackUrl(input.reportId);
  const text = [
    'Für eine Bug-Meldung wurde ein Cursor Cloud Agent gestartet.',
    '',
    `Mandant: ${input.tenantName}`,
    `Titel: ${input.title}`,
    `Report-ID: ${input.reportId}`,
    '',
    `Status im Superadmin: ${link}`,
    '',
    'Du erhältst eine weitere Mail, sobald ein Pull Request geöffnet wurde.',
  ].join('\n');

  try {
    await sendMail({ to, subject, text });
  } catch (err) {
    console.warn('[cursor-agent] started email failed:', err instanceof Error ? err.message : err);
  }
}

export async function sendCursorAgentPrReadyNotification(input: {
  reportId: string;
  title: string;
  prUrl: string;
}) {
  const to = getDefaultMailRecipient();
  if (!to) return;

  const platform = getPlatformName();
  const subject = `[${platform}] PR bereit: ${input.title}`;
  const board = superadminFeedbackUrl(input.reportId);
  const text = [
    'Der KI-Autofix hat einen Pull Request geöffnet.',
    '',
    `Titel: ${input.title}`,
    `Report-ID: ${input.reportId}`,
    `Pull Request: ${input.prUrl}`,
    '',
    `Superadmin: ${board}`,
  ].join('\n');

  try {
    await sendMail({ to, subject, text });
  } catch (err) {
    console.warn('[cursor-agent] pr email failed:', err instanceof Error ? err.message : err);
  }
}
