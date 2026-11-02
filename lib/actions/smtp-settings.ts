'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { canAccess, getActionContext } from '@/lib/auth/session';
import type { PermissionKey } from '@/lib/auth/permissions';

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptSecret, hasEncryptionKeyConfigured } from '@/lib/crypto/secret';
import { loadTenantSmtpPublicSettings, verifyTenantSmtp } from '@/lib/email/tenant-smtp';

const smtpFormSchema = z.object({
  host: z.string().trim().min(1, 'SMTP-Host fehlt'),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  smtp_user: z.string().trim().optional(),
  password: z.string().optional(),
  from_email: z.string().trim().email('Ungültige Absender-Adresse'),
  from_name: z.string().trim().optional(),
  reply_to: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .pipe(z.union([z.string().email('Ungültige Reply-To-Adresse'), z.undefined()])),
  enabled: z.boolean(),
});

export type SaveTenantSmtpResult = { ok: true } | { ok: false; error: string };

export type SaveTenantSmtpFormState = { ok?: boolean; error?: string | null };

export async function saveTenantSmtpSettingsAction(
  _prev: SaveTenantSmtpFormState,
  formData: FormData,
): Promise<SaveTenantSmtpFormState> {
  const result = await saveTenantSmtpSettings(formData);
  if (!result.ok) return { error: result.error };
  return { ok: true, error: null };
}

export async function saveTenantSmtpSettings(formData: FormData): Promise<SaveTenantSmtpResult> {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.smtp');
  const { tenantId } = ctx;

  if (!hasEncryptionKeyConfigured()) {
    return { ok: false, error: 'Server: SMTP_ENCRYPTION_KEY ist nicht konfiguriert.' };
  }

  const parsed = smtpFormSchema.safeParse({
    host: formData.get('host'),
    port: formData.get('port'),
    secure: formData.get('secure') === 'on',
    smtp_user: (formData.get('smtp_user') as string | null) ?? '',
    password: (formData.get('password') as string | null) ?? '',
    from_email: formData.get('from_email'),
    from_name: (formData.get('from_name') as string | null) ?? '',
    reply_to: (formData.get('reply_to') as string | null) ?? '',
    enabled: formData.get('enabled') === 'on',
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Ungültige Eingabe';
    return { ok: false, error: msg };
  }

  const input = parsed.data;
  const passwordRaw = input.password?.trim() ?? '';

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('tenant_smtp_settings')
    .select('password_encrypted')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  let passwordEncrypted = existing?.password_encrypted ?? '';
  if (passwordRaw) {
    passwordEncrypted = encryptSecret(passwordRaw);
  } else if (!passwordEncrypted) {
    return { ok: false, error: 'SMTP-Passwort ist erforderlich.' };
  }

  const row = {
    tenant_id: tenantId,
    host: input.host,
    port: input.port,
    secure: input.secure,
    smtp_user: input.smtp_user?.trim() || null,
    password_encrypted: passwordEncrypted,
    from_email: input.from_email,
    from_name: input.from_name?.trim() || null,
    reply_to: input.reply_to?.trim() || null,
    enabled: input.enabled,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from('tenant_smtp_settings').upsert(row, { onConflict: 'tenant_id' });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/app/einstellungen');
  return { ok: true };
}

export type SendTenantSmtpTestResult = { ok: true } | { ok: false; error: string };

export async function sendTenantSmtpTestMail(): Promise<SendTenantSmtpTestResult> {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.smtp');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const to = user?.email?.trim();
  if (!to) {
    return { ok: false, error: 'Keine E-Mail-Adresse für Ihr Konto hinterlegt.' };
  }

  const result = await verifyTenantSmtp(ctx.tenantId, to);
  if (!result.ok) {
    return {
      ok: false,
      error: result.reason === 'not_configured' ? result.message : result.error,
    };
  }
  return { ok: true };
}

export async function getTenantSmtpSettingsForUi() {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.smtp');
  return loadTenantSmtpPublicSettings(ctx.tenantId);
}
