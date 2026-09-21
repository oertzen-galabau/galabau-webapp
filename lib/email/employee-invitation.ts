import { sendMail } from '@/lib/email/smtp';

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

  const html = `
    <p>Hallo <strong>${input.firstName}</strong>,</p>
    <p>Sie wurden bei <strong>${input.platformName}</strong> als Mitarbeiter angelegt.</p>
    <p><a href="${input.inviteUrl}">Einladung öffnen</a></p>
    <p>Einmalpasswort: <strong>${input.tempPassword}</strong></p>
    <p>Der Link ist bis zum <strong>${expiryLabel}</strong> gültig.</p>
    <p>Nach der Anmeldung legen Sie bitte ein persönliches Passwort fest.</p>
  `.trim();

  return sendMail({ to: input.to, subject, text, html });
}
