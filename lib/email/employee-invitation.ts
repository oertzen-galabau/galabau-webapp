import { sendMail } from '@/lib/email/smtp';
import {
  buildTransactionalMailHtml,
  escapeHtml,
  mailCtaButtonHtml,
  mailSecretHighlightHtml,
} from '@/lib/email/mail-template';

export async function sendEmployeeInvitationEmail(input: {
  to: string;
  firstName: string;
  platformName: string;
  inviteUrl: string;
  tempPassword: string;
  expiresAt: Date;
}) {
  const expiryLabel = input.expiresAt.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const subject = `[${input.platformName}] Einladung zum Team`;
  const text = [
    `Hallo ${input.firstName},`,
    '',
    `Sie wurden bei ${input.platformName} als Mitarbeiter angelegt.`,
    '',
    `Einladungslink: ${input.inviteUrl}`,
    `Einmalpasswort: ${input.tempPassword}`,
    '',
    `Der Link ist bis zum ${expiryLabel} gültig.`,
    'Nach der Anmeldung legen Sie bitte ein persönliches Passwort fest.',
  ].join('\n');

  const safeFirst = escapeHtml(input.firstName);
  const safePlatform = escapeHtml(input.platformName);
  const html = buildTransactionalMailHtml({
    platformName: input.platformName,
    title: 'Einladung zum Team',
    leadParagraph: `Hallo ${safeFirst}, Sie wurden bei ${safePlatform} als Mitarbeiter angelegt. Öffnen Sie den Einladungslink und legen Sie ein persönliches Passwort fest.`,
    sections: [
      mailCtaButtonHtml(input.inviteUrl, 'Einladung öffnen'),
      mailSecretHighlightHtml('Einmalpasswort', input.tempPassword),
      `<tr><td style="padding:4px 24px 16px; font-size:14px; line-height:1.5; color:#52525b;">Der Link ist bis zum <strong>${escapeHtml(expiryLabel)}</strong> gültig.</td></tr>`,
    ],
    footnote:
      'Bewahren Sie das Einmalpasswort vertraulich auf. Wenn Sie diese E-Mail nicht erwartet haben, ignorieren Sie sie oder wenden Sie sich an Ihre Verwaltung.',
  });

  return sendMail({ to: input.to, subject, text, html });
}
