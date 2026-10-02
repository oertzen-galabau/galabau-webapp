import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canViewAllSites } from '@/lib/sites/access';
import type { PermissionKey } from '@/lib/auth/permissions';
import type { Profile, Tenant, UserRole } from '@/lib/types/database';
import type { SessionContext } from '@/lib/auth/session';

function sessionCtx(
  role: UserRole,
  permissions: PermissionKey[],
  isSuperadminBypass = false,
): SessionContext {
  const profile = {
    id: 'user-1',
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

describe('canViewAllSites', () => {
  it('gibt Vorarbeitern mit sites.view keine mandantenweite Sicht', () => {
    const ctx = sessionCtx('vorarbeiter', ['sites.view', 'sites.manage', 'nav.baustellen']);
    assert.equal(canViewAllSites(ctx), false);
  });

  it('gibt Verwaltung mandantenweite Sicht', () => {
    const ctx = sessionCtx('verwaltung', ['sites.view', 'sites.manage']);
    assert.equal(canViewAllSites(ctx), true);
  });

  it('gibt sites.assign_team mandantenweite Sicht', () => {
    const ctx = sessionCtx('vorarbeiter', ['sites.assign_team']);
    assert.equal(canViewAllSites(ctx), true);
  });
});
