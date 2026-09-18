'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendPasswordResetEmail } from '@/lib/email/password-reset';
import { getPlatformName } from '@/lib/tenant/config';
import {
  generateResetCode,
  getCodeExpiry,
  hashResetCode,
  isRateLimitWindowStart,
  MAX_REQUESTS_PER_HOUR,
  MAX_VERIFY_ATTEMPTS,
  normalizeEmail,
} from '@/lib/auth/password-reset';

const SUCCESS_MESSAGE =
  'Falls ein Konto mit dieser E-Mail existiert, wurde ein Code gesendet.';

export type PasswordResetResult =
  | { ok: true; message: string; simulated?: boolean }
  | { ok: false; error: string };

export async function requestPasswordResetCode(email: string): Promise<PasswordResetResult> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return { ok: false, error: 'Bitte geben Sie Ihre E-Mail-Adresse ein.' };
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!profile) {
    return { ok: true, message: SUCCESS_MESSAGE };
  }

  const windowStart = isRateLimitWindowStart().toISOString();
  const { count } = await admin
    .from('password_reset_codes')
    .select('id', { count: 'exact', head: true })
    .eq('email', normalizedEmail)
    .gte('created_at', windowStart);

  if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    return {
      ok: false,
      error: 'Zu viele Anfragen. Bitte versuchen Sie es in einer Stunde erneut.',
    };
  }

  const code = generateResetCode();
  const codeHash = hashResetCode(code);
  const expiresAt = getCodeExpiry().toISOString();
  const now = new Date().toISOString();

  await admin
    .from('password_reset_codes')
    .update({ used_at: now })
    .eq('email', normalizedEmail)
    .is('used_at', null);

  const { error: insertError } = await admin.from('password_reset_codes').insert({
    user_id: profile.id,
    email: normalizedEmail,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    return { ok: false, error: 'Code konnte nicht erstellt werden. Bitte erneut versuchen.' };
  }

  const mailResult = await sendPasswordResetEmail(normalizedEmail, code, getPlatformName());

  if (!mailResult.ok && mailResult.simulated) {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[password-reset] Simulierter Code für ${normalizedEmail}: ${code}`);
    }
    return { ok: true, message: SUCCESS_MESSAGE, simulated: true };
  }

  return { ok: true, message: SUCCESS_MESSAGE };
}

export async function resetPasswordWithCode(
  email: string,
  code: string,
  newPassword: string,
): Promise<PasswordResetResult> {
  const normalizedEmail = normalizeEmail(email);
  const trimmedCode = code.trim();

  if (!normalizedEmail || !trimmedCode) {
    return { ok: false, error: 'Bitte füllen Sie alle Felder aus.' };
  }

  if (!/^\d{6}$/.test(trimmedCode)) {
    return { ok: false, error: 'Der Code muss aus 6 Ziffern bestehen.' };
  }

  if (newPassword.length < 8) {
    return { ok: false, error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: resetRow, error: fetchError } = await admin
    .from('password_reset_codes')
    .select('id, user_id, code_hash, expires_at, attempts')
    .eq('email', normalizedEmail)
    .is('used_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError || !resetRow) {
    return { ok: false, error: 'Der Code ist ungültig oder abgelaufen.' };
  }

  if (resetRow.attempts >= MAX_VERIFY_ATTEMPTS) {
    await admin
      .from('password_reset_codes')
      .update({ used_at: now })
      .eq('id', resetRow.id);
    return { ok: false, error: 'Zu viele Fehlversuche. Bitte fordern Sie einen neuen Code an.' };
  }

  const codeHash = hashResetCode(trimmedCode);

  if (codeHash !== resetRow.code_hash) {
    await admin
      .from('password_reset_codes')
      .update({ attempts: resetRow.attempts + 1 })
      .eq('id', resetRow.id);
    return { ok: false, error: 'Der Code ist ungültig oder abgelaufen.' };
  }

  const { error: authError } = await admin.auth.admin.updateUserById(resetRow.user_id, {
    password: newPassword,
  });

  if (authError) {
    return { ok: false, error: authError.message ?? 'Passwort konnte nicht geändert werden.' };
  }

  await admin
    .from('password_reset_codes')
    .update({ used_at: now })
    .eq('id', resetRow.id);

  return { ok: true, message: 'Passwort wurde erfolgreich geändert.' };
}
