import nodemailer from 'nodemailer';

/** Extract a short, user-facing reason from nodemailer / SMTP errors (no secrets). */
export function describeSmtpSendError(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return 'E-Mail konnte nicht gesendet werden. Bitte später erneut versuchen.';
  }
  const e = err as { message?: string; code?: string; responseCode?: number; response?: string };
  const code = typeof e.code === 'string' ? e.code : '';
  const responseCode = e.responseCode;
  const msg = (e.message ?? '').toLowerCase();

  if (code === 'EAUTH' || msg.includes('invalid login') || msg.includes('authentication failed')) {
    return 'SMTP-Anmeldung fehlgeschlagen. Bitte SMTP-Benutzer und Passwort prüfen.';
  }
  if (
    code === 'ECONNECTION' ||
    code === 'ETIMEDOUT' ||
    msg.includes('econnrefused') ||
    msg.includes('getaddrinfo') ||
    msg.includes('enotfound')
  ) {
    return 'Keine Verbindung zum Mail-Server. Bitte SMTP-Host und Port prüfen (lokal ggf. Firewall/VPN).';
  }
  if (code === 'ESOCKET' || msg.includes('certificate') || msg.includes('ssl') || msg.includes('tls')) {
    return 'TLS/SSL-Fehler beim Mail-Server. Für Port 465 setzen Sie SMTP_SECURE=true oder nutzen Sie Port 587.';
  }
  if (responseCode === 550 || responseCode === 553 || msg.includes('sender') || msg.includes('reject')) {
    return 'Der Mail-Server hat die Absendeadresse abgelehnt. Bitte SMTP_FROM und Zugangsdaten prüfen.';
  }

  if (e.message && e.message.length < 200) {
    return `E-Mail-Versand fehlgeschlagen: ${e.message}`;
  }
  return 'E-Mail konnte nicht gesendet werden. Bitte später erneut versuchen.';
}

export type SendMailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_FROM,
  );
}

function createTransport() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD ?? '',
        }
      : undefined,
  });
}

export function getDefaultMailRecipient() {
  return process.env.SMTP_TO ?? process.env.SMTP_FROM ?? '';
}

export type SendMailResult =
  | { ok: true; simulated: false }
  | { ok: false; simulated: true; message: string }
  | { ok: false; simulated: false; error: string };

export function sendMailFailureText(result: Extract<SendMailResult, { ok: false }>) {
  return result.simulated ? result.message : result.error;
}

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  if (!smtpConfigured()) {
    return {
      ok: false,
      simulated: true,
      message: 'SMTP nicht konfiguriert — Versand simuliert.',
    };
  }

  const transporter = createTransport();

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.isBuffer(a.content) ? a.content : Buffer.from(a.content),
        contentType: a.contentType,
      })),
    });
  } catch (err) {
    console.error('[smtp] sendMail failed:', err instanceof Error ? err.message : err);
    return {
      ok: false,
      simulated: false,
      error: describeSmtpSendError(err),
    };
  }

  return { ok: true, simulated: false };
}

export { smtpConfigured };
