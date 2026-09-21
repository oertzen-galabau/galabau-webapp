import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  allPermissionKeys,
  type PermissionKey,
} from '@/lib/auth/permissions';
import { isSuperadmin } from '@/lib/auth/roles';
import { getTenantBySlug } from '@/lib/tenant/resolve';
import { loadRolePermissions } from '@/lib/tenant/roles';
import type { Profile, Tenant, UserRole } from '@/lib/types/database';

export const DEV_ROLE_COOKIE = 'dev_role_override';

export type SessionContext = {
  userId: string;
  profile: Profile;
  tenant: Tenant | null;
  tenantRoleId: string | null;
  tenantRoleName: string | null;
  permissions: Set<PermissionKey>;
  isSuperadminBypass: boolean;
  devRoleOverrideId: string | null;
};

export type ActionContext = {
  userId: string;
  tenantId: string;
  tenantRoleId: string | null;
  permissions: Set<PermissionKey>;
  isSuperadminBypass: boolean;
  devRoleOverrideId: string | null;
};

async function readDevRoleOverrideId(): Promise<string | null> {
  if (process.env.NODE_ENV !== 'development') return null;
  const cookieStore = await cookies();
  const value = cookieStore.get(DEV_ROLE_COOKIE)?.value;
  if (value && /^[0-9a-f-]{36}$/i.test(value)) return value;
  return null;
}

async function resolvePermissions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: Profile,
  devRoleOverrideId: string | null,
): Promise<{
  tenantRoleId: string | null;
  tenantRoleName: string | null;
  permissions: Set<PermissionKey>;
  isSuperadminBypass: boolean;
}> {
  if (isSuperadmin(profile.role) && !devRoleOverrideId) {
    return {
      tenantRoleId: null,
      tenantRoleName: 'Superadmin',
      permissions: allPermissionKeys(),
      isSuperadminBypass: true,
    };
  }

  const effectiveRoleId = devRoleOverrideId ?? profile.tenant_role_id;
  if (!effectiveRoleId) {
    return {
      tenantRoleId: null,
      tenantRoleName: null,
      permissions: new Set(),
      isSuperadminBypass: false,
    };
  }

  const [{ data: role }, permissions] = await Promise.all([
    supabase.from('tenant_roles').select('id, name').eq('id', effectiveRoleId).maybeSingle(),
    loadRolePermissions(supabase, effectiveRoleId),
  ]);

  return {
    tenantRoleId: effectiveRoleId,
    tenantRoleName: role?.name ?? null,
    permissions,
    isSuperadminBypass: false,
  };
}

async function enrichContext(
  userId: string,
  profile: Profile,
  tenant: Tenant | null,
  devRoleOverrideId: string | null,
): Promise<SessionContext> {
  const supabase = await createClient();
  const access = await resolvePermissions(supabase, profile, devRoleOverrideId);
  return {
    userId,
    profile,
    tenant,
    devRoleOverrideId,
    ...access,
  };
}

function assertActiveProfile(profile: Profile) {
  if (profile.is_active === false) {
    redirect('/login?inactive=1');
  }
}

function assertPasswordReady(profile: Profile) {
  if (profile.must_change_password) {
    redirect('/passwort-setzen');
  }
}

export async function requireAuth(): Promise<SessionContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  assertActiveProfile(profile as Profile);

  let tenant: Tenant | null = null;
  if (profile.tenant_id) {
    const { data } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).single();
    tenant = data as Tenant | null;
  }

  const devRoleOverrideId = await readDevRoleOverrideId();
  return enrichContext(user.id, profile as Profile, tenant, devRoleOverrideId);
}

export async function requireSuperadmin() {
  const ctx = await requireAuth();
  if (!isSuperadmin(ctx.profile.role)) redirect('/login');
  return ctx;
}

export async function requireTenantMember(tenantSlug?: string) {
  const ctx = await requireAuth();
  if (isSuperadmin(ctx.profile.role)) return ctx;
  if (!ctx.tenant) redirect('/login');
  if (tenantSlug && ctx.tenant.slug !== tenantSlug) redirect('/login');
  assertPasswordReady(ctx.profile);
  return ctx;
}

async function resolveTenantId(profile: Profile): Promise<string | null> {
  if (profile.tenant_id) return profile.tenant_id;
  if (!isSuperadmin(profile.role)) return null;

  const headerList = await headers();
  const tenantSlug = headerList.get('x-tenant-slug');
  if (!tenantSlug) return null;

  const tenant = await getTenantBySlug(tenantSlug);
  return tenant?.id ?? null;
}

export async function getActionContext(): Promise<ActionContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Nicht angemeldet');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) throw new Error('Kein Profil');

  if (profile.is_active === false) {
    throw new Error('Dieses Konto ist deaktiviert.');
  }
  if (profile.must_change_password) {
    throw new Error('Bitte legen Sie zuerst Ihr persönliches Passwort fest.');
  }

  const devRoleOverrideId = await readDevRoleOverrideId();
  const tenantId = await resolveTenantId(profile as Profile);
  if (!tenantId) throw new Error('Kein Mandant');

  const access = await resolvePermissions(supabase, profile as Profile, devRoleOverrideId);

  return {
    userId: user.id,
    tenantId,
    devRoleOverrideId,
    tenantRoleId: access.tenantRoleId,
    permissions: access.permissions,
    isSuperadminBypass: access.isSuperadminBypass,
  };
}

export function canAccess(ctx: Pick<SessionContext | ActionContext, 'permissions' | 'isSuperadminBypass'>, key: PermissionKey) {
  if (ctx.isSuperadminBypass) return true;
  return ctx.permissions.has(key);
}
