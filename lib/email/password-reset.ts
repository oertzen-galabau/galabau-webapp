import { sendMail } from '@/lib/email/smtp';

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

  const html = `
    <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts bei <strong>${platformName}</strong> gestellt.</p>
    <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em; margin: 24px 0;">${code}</p>
    <p>Der Code ist <strong>15 Minuten</strong> gültig.</p>
    <p style="color: #666;">Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.</p>
  `.trim();

  return sendMail({ to, subject, text, html });
}
