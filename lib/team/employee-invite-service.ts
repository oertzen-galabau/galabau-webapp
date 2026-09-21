import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildInviteUrl,
  generateInviteToken,
  getInviteExpiry,
  hashInviteToken,
  hashTempPassword,
  type EmployeeInvitationRow,
} from '@/lib/auth/employee-invitations';

type AdminClient = SupabaseClient;

export async function revokeActiveInvitations(admin: AdminClient, userId: string) {
  const now = new Date().toISOString();
  const { error } = await admin
    .from('employee_invitations')
    .update({ revoked_at: now })
    .eq('user_id', userId)
    .is('used_at', null)
    .is('revoked_at', null);

  if (error) throw new Error(error.message);
}

export async function createEmployeeInvitation(
  admin: AdminClient,
  input: {
    tenantId: string;
    userId: string;
    createdBy: string;
    tempPassword: string;
  },
) {
  await revokeActiveInvitations(admin, input.userId);

  const { token, tokenHash } = generateInviteToken();
  const expiresAt = getInviteExpiry();

  const { error } = await admin.from('employee_invitations').insert({
    tenant_id: input.tenantId,
    user_id: input.userId,
    token_hash: tokenHash,
    temp_password_hash: hashTempPassword(input.tempPassword),
    expires_at: expiresAt.toISOString(),
    created_by: input.createdBy,
  });

  if (error) throw new Error(error.message);

  return {
    token,
    inviteUrl: buildInviteUrl(token),
    expiresAt,
  };
}

export async function fetchInvitationByToken(admin: AdminClient, token: string) {
  const tokenHash = hashInviteToken(token);
  const { data, error } = await admin
    .from('employee_invitations')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as EmployeeInvitationRow | null;
}

export async function fetchLatestInvitation(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from('employee_invitations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as EmployeeInvitationRow | null;
}

export async function markInvitationUsed(admin: AdminClient, invitationId: string) {
  const { error } = await admin
    .from('employee_invitations')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invitationId)
    .is('used_at', null);

  if (error) throw new Error(error.message);
}
