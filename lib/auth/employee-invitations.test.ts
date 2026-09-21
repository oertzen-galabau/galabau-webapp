import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildInviteUrl,
  generateInviteToken,
  generateTempPassword,
  getInvitationStatus,
  getInviteExpiry,
  hashInviteToken,
  hashTempPassword,
  INVITE_TTL_MS,
  validateInvitationState,
  verifyTempPassword,
} from './employee-invitations';

describe('employee-invitations', () => {
  it('generates stable token hashes', () => {
    const { token, tokenHash } = generateInviteToken();
    assert.ok(token.length >= 32);
    assert.equal(tokenHash, hashInviteToken(token));
    assert.notEqual(tokenHash, hashInviteToken(`${token}x`));
  });

  it('generates temp passwords with minimum length', () => {
    const password = generateTempPassword();
    assert.ok(password.length >= 12);
  });

  it('verifies temporary passwords without storing plaintext', () => {
    const password = generateTempPassword();
    const passwordHash = hashTempPassword(password);

    assert.notEqual(passwordHash, password);
    assert.equal(verifyTempPassword(password, passwordHash), true);
    assert.equal(verifyTempPassword(`${password}x`, passwordHash), false);
    assert.equal(verifyTempPassword(password, null), false);
  });

  it('builds invite urls on root domain', () => {
    const url = buildInviteUrl('abc123');
    assert.match(url, /\/einladung\/abc123$/);
  });

  it('expires invitations after seven days', () => {
    const now = new Date('2026-01-01T12:00:00.000Z');
    const expiry = getInviteExpiry(now);
    assert.equal(expiry.getTime() - now.getTime(), INVITE_TTL_MS);
  });

  it('detects invitation lifecycle states', () => {
    const base = {
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      revoked_at: null,
      used_at: null,
    };

    assert.equal(getInvitationStatus(base), 'pending');
    assert.deepEqual(validateInvitationState(base), { valid: true });

    assert.equal(
      getInvitationStatus({ ...base, used_at: new Date().toISOString() }),
      'used',
    );
    assert.equal(
      validateInvitationState({ ...base, used_at: new Date().toISOString() }).valid,
      false,
    );

    assert.equal(
      getInvitationStatus({ ...base, revoked_at: new Date().toISOString() }),
      'revoked',
    );

    assert.equal(
      getInvitationStatus({
        ...base,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      }),
      'expired',
    );
  });
});
