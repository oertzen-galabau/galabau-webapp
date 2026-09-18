'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCurrentPassword } from '@/lib/auth/password-verify';
import type { PermissionKey } from '@/lib/auth/permissions';
import { canAccess, getActionContext } from '@/lib/auth/session';

export type ProfileActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

function revalidateProfilePaths() {
  revalidatePath('/app/profil');
  revalidatePath('/app', 'layout');
}

async function loadOwnEmail(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();

  if (error || !profile?.email) {
    throw new Error('Profil konnte nicht geladen werden.');
  }

  return profile.email.trim();
}

export async function updateOwnProfile(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'profile.edit_self');

  const firstName = (formData.get('first_name') as string)?.trim();
  const lastName = (formData.get('last_name') as string)?.trim();
  if (!firstName || !lastName) {
    throw new Error('Vor- und Nachname sind erforderlich.');
  }

  const profileUpdate = {
    first_name: firstName,
    last_name: lastName,
    phone: (formData.get('phone') as string)?.trim() || null,
    salutation: (formData.get('salutation') as string)?.trim() || null,
    address: (formData.get('address') as string)?.trim() || null,
    zip_code: (formData.get('zip_code') as string)?.trim() || null,
    city: (formData.get('city') as string)?.trim() || null,
    birthday: (formData.get('birthday') as string)?.trim() || null,
  };

  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update(profileUpdate).eq('id', ctx.userId);
  if (error) throw new Error(error.message);

  revalidateProfilePaths();
}

export async function changeOwnEmail(
  _prev: ProfileActionResult | null,
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const ctx = await getActionContext();
    requirePerm(ctx, 'profile.change_email');

    const newEmail = (formData.get('new_email') as string)?.trim().toLowerCase();
    const currentPassword = formData.get('current_password') as string;

    if (!newEmail || !currentPassword) {
      return { ok: false, error: 'Bitte füllen Sie alle Felder aus.' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return { ok: false, error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' };
    }

    const currentEmail = await loadOwnEmail(ctx.userId);
    if (newEmail === currentEmail.toLowerCase()) {
      return { ok: false, error: 'Die neue E-Mail ist identisch mit der aktuellen.' };
    }

    const admin = createAdminClient();
    const { data: duplicate } = await admin
      .from('profiles')
      .select('id')
      .eq('tenant_id', ctx.tenantId)
      .eq('email', newEmail)
      .neq('id', ctx.userId)
      .maybeSingle();

    if (duplicate) {
      return { ok: false, error: 'Diese E-Mail wird im Mandanten bereits verwendet.' };
    }

    const verified = await verifyCurrentPassword(currentEmail, currentPassword);
    if (!verified) {
      return { ok: false, error: 'Das aktuelle Passwort ist falsch.' };
    }

    const { error: authError } = await admin.auth.admin.updateUserById(ctx.userId, { email: newEmail });
    if (authError) {
      return { ok: false, error: authError.message ?? 'E-Mail konnte nicht geändert werden.' };
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ email: newEmail })
      .eq('id', ctx.userId);

    if (profileError) {
      return { ok: false, error: profileError.message };
    }

    revalidateProfilePaths();
    return { ok: true, message: 'E-Mail wurde erfolgreich geändert.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'E-Mail konnte nicht geändert werden.' };
  }
}

export async function changeOwnPassword(
  _prev: ProfileActionResult | null,
  formData: FormData,
): Promise<ProfileActionResult> {
  try {
    const ctx = await getActionContext();
    requirePerm(ctx, 'profile.change_password');

    const currentPassword = formData.get('current_password') as string;
    const newPassword = formData.get('new_password') as string;
    const confirmPassword = formData.get('confirm_password') as string;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return { ok: false, error: 'Bitte füllen Sie alle Felder aus.' };
    }

    if (newPassword.length < 8) {
      return { ok: false, error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' };
    }

    if (newPassword !== confirmPassword) {
      return { ok: false, error: 'Die Passwort-Bestätigung stimmt nicht überein.' };
    }

    if (newPassword === currentPassword) {
      return { ok: false, error: 'Das neue Passwort muss sich vom aktuellen unterscheiden.' };
    }

    const currentEmail = await loadOwnEmail(ctx.userId);
    const verified = await verifyCurrentPassword(currentEmail, currentPassword);
    if (!verified) {
      return { ok: false, error: 'Das aktuelle Passwort ist falsch.' };
    }

    const admin = createAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(ctx.userId, {
      password: newPassword,
    });

    if (authError) {
      return { ok: false, error: authError.message ?? 'Passwort konnte nicht geändert werden.' };
    }

    return { ok: true, message: 'Passwort wurde erfolgreich geändert.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Passwort konnte nicht geändert werden.' };
  }
}
