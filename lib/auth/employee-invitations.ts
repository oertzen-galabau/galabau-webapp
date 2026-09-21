import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { getRootDomain } from '@/lib/tenant/config';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const TEMP_PASSWORD_LENGTH = 14;

export type EmployeeInvitationRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  token_hash: string;
  temp_password_hash: string | null;
  expires_at: string;
  created_by: string | null;
  revoked_at: string | null;
  used_at: string | null;
  created_at: string;
};

export type InvitationStatus = 'pending' | 'used' | 'revoked' | 'expired';

const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

function getPepper() {
  const pepper = process.env.INVITE_TOKEN_PEPPER ?? process.env.PASSWORD_RESET_PEPPER;
  if (pepper) return pepper;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('INVITE_TOKEN_PEPPER oder PASSWORD_RESET_PEPPER fehlt in der Produktionsumgebung.');
  }
  return 'dev-only-invite-pepper';
}

export function hashInviteToken(token: string) {
  return createHash('sha256').update(`${token}:${getPepper()}`).digest('hex');
}

export function hashTempPassword(password: string) {
  return createHash('sha256')
    .update(`employee-invitation-password:${password}:${getPepper()}`)
    .digest('hex');
}

export function verifyTempPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash || !/^[a-f0-9]{64}$/i.test(storedHash)) return false;
  const actual = Buffer.from(hashTempPassword(password), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function generateInviteToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInviteToken(token) };
}

export function generateTempPassword(length = TEMP_PASSWORD_LENGTH) {
  let password = '';
  for (let i = 0; i < length; i += 1) {
    password += TEMP_PASSWORD_CHARS[randomInt(0, TEMP_PASSWORD_CHARS.length)];
  }
  return password;
}

export function getInviteExpiry(from = new Date()) {
  return new Date(from.getTime() + INVITE_TTL_MS);
}

export function buildInviteUrl(token: string) {
  const root = getRootDomain();
  const protocol = root.startsWith('localhost') ? 'http' : 'https';
  return `${protocol}://${root}/einladung/${token}`;
}

export function getInvitationStatus(
  invitation: Pick<EmployeeInvitationRow, 'expires_at' | 'revoked_at' | 'used_at'>,
  now = new Date(),
): InvitationStatus {
  if (invitation.used_at) return 'used';
  if (invitation.revoked_at) return 'revoked';
  if (new Date(invitation.expires_at).getTime() <= now.getTime()) return 'expired';
  return 'pending';
}

export function validateInvitationState(
  invitation: Pick<EmployeeInvitationRow, 'expires_at' | 'revoked_at' | 'used_at'> | null | undefined,
  now = new Date(),
): { valid: true } | { valid: false; reason: string } {
  if (!invitation) {
    return { valid: false, reason: 'Dieser Einladungslink ist ungültig.' };
  }

  const status = getInvitationStatus(invitation, now);
  if (status === 'used') {
    return { valid: false, reason: 'Dieser Einladungslink wurde bereits verwendet.' };
  }
  if (status === 'revoked') {
    return { valid: false, reason: 'Dieser Einladungslink wurde widerrufen. Bitte die Verwaltung um neue Zugangsdaten bitten.' };
  }
  if (status === 'expired') {
    return { valid: false, reason: 'Dieser Einladungslink ist abgelaufen. Bitte die Verwaltung um neue Zugangsdaten bitten.' };
  }

  return { valid: true };
}

export function invitationStatusLabel(status: InvitationStatus) {
  switch (status) {
    case 'pending':
      return 'Ausstehend';
    case 'used':
      return 'Verwendet';
    case 'revoked':
      return 'Widerrufen';
    case 'expired':
      return 'Abgelaufen';
    default:
      return status;
  }
}
