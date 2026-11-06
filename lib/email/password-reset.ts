import { sendMail } from '@/lib/email/smtp';
import { buildTransactionalMailHtml, escapeHtml, mailSecretHighlightHtml } from '@/lib/email/mail-template';

export async function sendPasswordResetEmail(to: string, code: string, platformName: string) {
  const subject = `[${platformName}] Passwort zurücksetzen`;
  const text = [
    `Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts bei ${platformName} gestellt.`,
    '',
    `Ihr Code: ${code}`,
    '',
    'Der Code ist 15 Minuten gültig.',
    'Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.',
  ].join('\n');

  const safePlatform = escapeHtml(platformName);
  const html = buildTransactionalMailHtml({
    platformName,
    title: 'Passwort zurücksetzen',
    leadParagraph: `Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts bei ${safePlatform} gestellt. Geben Sie den folgenden Code auf der Seite „Passwort zurücksetzen“ ein.`,
    sections: [
      mailSecretHighlightHtml('Ihr Bestätigungscode', code),
      `<tr><td style="padding:4px 24px 8px; font-size:14px; line-height:1.5; color:#52525b;">Der Code ist <strong>15 Minuten</strong> gültig.</td></tr>`,
    ],
    footnote:
      'Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.',
  });

  return sendMail({ to, subject, text, html });
}
