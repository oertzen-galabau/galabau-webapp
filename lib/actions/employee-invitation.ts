'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import {
  validateInvitationState,
  verifyTempPassword,
} from '@/lib/auth/employee-invitations';
import {
  fetchInvitationByToken,
  markInvitationUsed,
} from '@/lib/team/employee-invite-service';

export type InvitationActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export type InvitationPreview = {
  email: string;
  firstName: string;
  lastName: string;
  expiresAt: string;
};

export async function getInvitationPreview(token: string): Promise<InvitationPreview | null> {
  const admin = createAdminClient();
  const invitation = await fetchInvitationByToken(admin, token);
  const validation = validateInvitationState(invitation);
  if (!validation.valid || !invitation) return null;

  const { data: profile, error } = await admin
    .from('profiles')
    .select('email, first_name, last_name, is_active')
    .eq('id', invitation.user_id)
    .single();

  if (error || !profile?.email || !profile.is_active) return null;

  return {
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    expiresAt: invitation.expires_at,
  };
}

export async function activateInvitation(
  _prev: InvitationActionResult | null,
  formData: FormData,
): Promise<InvitationActionResult> {
  try {
    const token = (formData.get('token') as string)?.trim();
    const tempPassword = formData.get('temp_password') as string;
    const newPassword = formData.get('new_password') as string;
    const confirmPassword = formData.get('confirm_password') as string;

    if (!token || !tempPassword || !newPassword || !confirmPassword) {
      return { ok: false, error: 'Bitte füllen Sie alle Felder aus.' };
    }
    if (newPassword.length < 8) {
      return { ok: false, error: 'Das Passwort muss mindestens 8 Zeichen haben.' };
    }
    if (newPassword !== confirmPassword) {
      return { ok: false, error: 'Passwort und Bestätigung stimmen nicht überein.' };
    }

    const admin = createAdminClient();
    const invitation = await fetchInvitationByToken(admin, token);
    const validation = validateInvitationState(invitation);
    if (!validation.valid) {
      return { ok: false, error: validation.reason };
    }
    if (!invitation) {
      return { ok: false, error: 'Dieser Einladungslink ist ungültig.' };
    }
    if (!verifyTempPassword(tempPassword, invitation.temp_password_hash)) {
      return { ok: false, error: 'Einmalpasswort ist ungültig.' };
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('email, must_change_password, is_active, tenants(slug)')
      .eq('id', invitation.user_id)
      .single();

    if (profileError || !profile?.email) {
      return { ok: false, error: 'Profil konnte nicht geladen werden.' };
    }
    if (!profile.is_active) {
      return { ok: false, error: 'Dieses Konto ist deaktiviert.' };
    }
    if (!profile.must_change_password) {
      return { ok: false, error: 'Für dieses Konto ist kein Passwortwechsel mehr erforderlich.' };
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(invitation.user_id, {
      password: newPassword,
    });
    if (passwordError) {
      return { ok: false, error: 'Passwort konnte nicht gesetzt werden. Bitte versuchen Sie es erneut.' };
    }

    const { error: profileUpdateError } = await admin
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', invitation.user_id);

    if (profileUpdateError) {
      return { ok: false, error: 'Konto konnte nicht aktiviert werden. Bitte versuchen Sie es erneut.' };
    }

    await markInvitationUsed(admin, invitation.id);

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: newPassword,
    });
    if (signInError) {
      return { ok: false, error: 'Passwort wurde gesetzt. Bitte melden Sie sich jetzt regulär an.' };
    }

    const tenantSlug = (profile.tenants as { slug?: string } | null)?.slug;
    if (tenantSlug) {
      const cookieStore = await cookies();
      cookieStore.set('tenant_slug', tenantSlug, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    }

    redirect('/app?welcome=1');
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Passwort konnte nicht gesetzt werden.',
    };
  }
}

export async function completeForcedPasswordChange(
  _prev: InvitationActionResult | null,
  formData: FormData,
): Promise<InvitationActionResult> {
  try {
    const newPassword = formData.get('new_password') as string;
    const confirmPassword = formData.get('confirm_password') as string;

    if (!newPassword || !confirmPassword) {
      return { ok: false, error: 'Bitte füllen Sie alle Felder aus.' };
    }
    if (newPassword.length < 8) {
      return { ok: false, error: 'Das Passwort muss mindestens 8 Zeichen haben.' };
    }
    if (newPassword !== confirmPassword) {
      return { ok: false, error: 'Passwort und Bestätigung stimmen nicht überein.' };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: 'Bitte melden Sie sich zuerst an.' };
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('must_change_password, is_active, tenants(slug)')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { ok: false, error: 'Profil konnte nicht geladen werden.' };
    }
    if (!profile.is_active) {
      return { ok: false, error: 'Dieses Konto ist deaktiviert.' };
    }
    if (!profile.must_change_password) {
      redirect('/app');
    }

    const tenantSlug = (profile.tenants as { slug?: string } | null)?.slug;

    const { error: passwordError } = await admin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (passwordError) {
      return { ok: false, error: passwordError.message };
    }

    const { error: profileUpdateError } = await admin
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user.id);

    if (profileUpdateError) {
      return { ok: false, error: profileUpdateError.message };
    }

    if (tenantSlug) {
      const cookieStore = await cookies();
      cookieStore.set('tenant_slug', tenantSlug, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    }

    redirect('/app?welcome=1');
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Passwort konnte nicht gesetzt werden.',
    };
  }
}
