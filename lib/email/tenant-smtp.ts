import nodemailer from 'nodemailer';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret, hasEncryptionKeyConfigured } from '@/lib/crypto/secret';
import type { SendMailInput } from '@/lib/email/smtp';

export type TenantSmtpPublicSettings = {
  tenant_id: string;
  host: string;
  port: number;
  secure: boolean;
  smtp_user: string | null;
  from_email: string;
  from_name: string | null;
  reply_to: string | null;
  enabled: boolean;
  password_configured: boolean;
};

export type TenantSmtpConfig = TenantSmtpPublicSettings & {
  password: string;
};

export type SendTenantMailResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured'; message: string }
  | { ok: false; reason: 'send_failed'; error: string };

const NOT_CONFIGURED_MESSAGE =
  'E-Mail-Versand ist nicht eingerichtet. Bitte SMTP unter Einstellungen → E-Mail-Versand konfigurieren.';

export function sendTenantMailFailureText(result: Extract<SendTenantMailResult, { ok: false }>): string {
  if (result.reason === 'not_configured') return result.message;
  return result.error;
}

export async function loadTenantSmtpPublicSettings(
  tenantId: string,
): Promise<TenantSmtpPublicSettings | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenant_smtp_settings')
    .select(
      'tenant_id, host, port, secure, smtp_user, from_email, from_name, reply_to, enabled, password_encrypted',
    )
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    tenant_id: data.tenant_id,
    host: data.host,
    port: data.port,
    secure: data.secure,
    smtp_user: data.smtp_user,
    from_email: data.from_email,
    from_name: data.from_name,
    reply_to: data.reply_to,
    enabled: data.enabled,
    password_configured: Boolean(data.password_encrypted),
  };
}

async function loadTenantSmtpConfig(tenantId: string): Promise<TenantSmtpConfig | null> {
  if (!hasEncryptionKeyConfigured()) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenant_smtp_settings')
    .select(
      'tenant_id, host, port, secure, smtp_user, from_email, from_name, reply_to, enabled, password_encrypted',
    )
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data || !data.enabled) return null;
  if (!data.host || !data.from_email || !data.password_encrypted) return null;

  let password: string;
  try {
    password = decryptSecret(data.password_encrypted);
  } catch (err) {
    console.error('[tenant-smtp] decrypt failed:', err instanceof Error ? err.message : err);
    return null;
  }

  return {
    tenant_id: data.tenant_id,
    host: data.host,
    port: data.port,
    secure: data.secure,
    smtp_user: data.smtp_user,
    from_email: data.from_email,
    from_name: data.from_name,
    reply_to: data.reply_to,
    enabled: data.enabled,
    password_configured: true,
    password,
  };
}

function formatFrom(config: TenantSmtpConfig): string {
  if (config.from_name?.trim()) {
    return `"${config.from_name.replace(/"/g, '\\"')}" <${config.from_email}>`;
  }
  return config.from_email;
}

export function getTenantDefaultMailRecipient(config: TenantSmtpPublicSettings | null): string {
  if (!config) return '';
  return config.reply_to?.trim() || config.from_email;
}

export async function sendTenantMail(
  tenantId: string,
  input: SendMailInput,
): Promise<SendTenantMailResult> {
  const config = await loadTenantSmtpConfig(tenantId);
  if (!config) {
    return { ok: false, reason: 'not_configured', message: NOT_CONFIGURED_MESSAGE };
  }

  const port = config.port;
  const secure = config.secure || port === 465;
  const transporter = nodemailer.createTransport({
    host: config.host,
    port,
    secure,
    auth: config.smtp_user
      ? {
          user: config.smtp_user,
          pass: config.password,
        }
      : undefined,
  });

  const replyTo = input.replyTo ?? config.reply_to ?? undefined;

  try {
    await transporter.sendMail({
      from: formatFrom(config),
      to: input.to,
      replyTo,
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
    console.error('[tenant-smtp] send failed:', err instanceof Error ? err.message : err);
    return {
      ok: false,
      reason: 'send_failed',
      error: 'E-Mail konnte nicht gesendet werden. Bitte SMTP-Einstellungen prüfen.',
    };
  }

  return { ok: true };
}

export async function verifyTenantSmtp(tenantId: string, to: string): Promise<SendTenantMailResult> {
  return sendTenantMail(tenantId, {
    to,
    subject: 'Testmail – GaLaBau App',
    text: 'Diese Testmail bestätigt, dass Ihre SMTP-Einstellungen funktionieren.',
    html: '<p>Diese Testmail bestätigt, dass Ihre SMTP-Einstellungen funktionieren.</p>',
  });
}
