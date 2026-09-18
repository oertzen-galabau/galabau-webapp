import nodemailer from 'nodemailer';

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

export async function sendMail(input: SendMailInput) {
  if (!smtpConfigured()) {
    return {
      ok: false as const,
      simulated: true,
      message: 'SMTP nicht konfiguriert — Versand simuliert.',
    };
  }

  const transporter = createTransport();

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

  return { ok: true as const, simulated: false };
}

export { smtpConfigured };
