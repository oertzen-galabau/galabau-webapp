import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canViewAllReports,
  userCanEditDailyLog,
  userCanViewDailyLog,
} from '@/lib/documentation/report-access';
import type { PermissionKey } from '@/lib/auth/permissions';
import type { Profile, Tenant, UserRole } from '@/lib/types/database';
import type { SessionContext } from '@/lib/auth/session';

function sessionCtx(
  role: UserRole,
  permissions: PermissionKey[],
  userId = 'user-1',
  isSuperadminBypass = false,
): SessionContext {
  const profile = {
    id: userId,
    role,
    tenant_id: 'tenant-1',
  } as Profile;
  return {
    userId: profile.id,
    profile,
    tenant: { id: 'tenant-1' } as Tenant,
    tenantRoleId: 'role-1',
    tenantRoleName: role,
    permissions: new Set(permissions),
    isSuperadminBypass,
    devRoleOverrideId: null,
  };
}

describe('canViewAllReports', () => {
  it('gibt Mitarbeitern ohne documentation.view_all keine Gesamtsicht', () => {
    const ctx = sessionCtx('mitarbeiter', ['nav.baustellen']);
    assert.equal(canViewAllReports(ctx), false);
  });

  it('gibt Vorarbeitern mit documentation.view_all Gesamtsicht', () => {
    const ctx = sessionCtx('vorarbeiter', ['documentation.view_all']);
    assert.equal(canViewAllReports(ctx), true);
  });
});

describe('userCanViewDailyLog', () => {
  it('erlaubt dem Ersteller den Zugriff', () => {
    const ctx = sessionCtx('mitarbeiter', ['nav.baustellen'], 'user-1');
    assert.equal(userCanViewDailyLog(ctx, { created_by: 'user-1' }), true);
  });

  it('verweigert anderen Mitarbeitern den Zugriff', () => {
    const ctx = sessionCtx('mitarbeiter', ['nav.baustellen'], 'user-1');
    assert.equal(userCanViewDailyLog(ctx, { created_by: 'user-2' }), false);
  });

  it('erlaubt view_all den Zugriff auf fremde Berichte', () => {
    const ctx = sessionCtx('vorarbeiter', ['documentation.view_all'], 'user-1');
    assert.equal(userCanViewDailyLog(ctx, { created_by: 'user-2' }), true);
  });

  it('verweigert ohne created_by (Altdaten) für Mitarbeiter', () => {
    const ctx = sessionCtx('mitarbeiter', ['nav.baustellen'], 'user-1');
    assert.equal(userCanViewDailyLog(ctx, { created_by: null }), false);
  });
});

describe('userCanEditDailyLog', () => {
  it('erfordert documentation.manage', () => {
    const ctx = sessionCtx('mitarbeiter', ['nav.baustellen'], 'user-1');
    assert.equal(userCanEditDailyLog(ctx, { created_by: 'user-1' }), false);
  });

  it('erlaubt Bearbeiten für Ersteller mit manage', () => {
    const ctx = sessionCtx('vorarbeiter', ['documentation.manage', 'sites.view'], 'user-1');
    assert.equal(userCanEditDailyLog(ctx, { created_by: 'user-1' }), true);
  });
});
