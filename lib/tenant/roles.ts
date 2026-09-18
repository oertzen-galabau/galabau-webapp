import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_ROLE_PERMISSIONS,
  expandPermissions,
  SYSTEM_ROLE_LABELS,
  SYSTEM_ROLE_SLUGS,
  type PermissionKey,
  type SystemRoleSlug,
} from '@/lib/auth/permissions';

export type TenantRole = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  is_system: boolean;
  sort_order: number;
  created_at: string;
};

export async function seedTenantRoles(
  admin: SupabaseClient,
  tenantId: string,
): Promise<Map<SystemRoleSlug, string>> {
  const roleIds = new Map<SystemRoleSlug, string>();

  for (let i = 0; i < SYSTEM_ROLE_SLUGS.length; i++) {
    const slug = SYSTEM_ROLE_SLUGS[i];
    const { data: role, error } = await admin
      .from('tenant_roles')
      .insert({
        tenant_id: tenantId,
        name: SYSTEM_ROLE_LABELS[slug],
        slug,
        is_system: true,
        sort_order: i,
      })
      .select('id, slug')
      .single();

    if (error || !role) throw new Error(error?.message ?? `Rolle ${slug} konnte nicht angelegt werden`);

    roleIds.set(slug, role.id);

    const permissions = expandPermissions(DEFAULT_ROLE_PERMISSIONS[slug]);
    const rows = [...permissions].map((permission_key) => ({
      tenant_role_id: role.id,
      permission_key,
      granted: true,
    }));

    const { error: permError } = await admin.from('tenant_role_permissions').insert(rows);
    if (permError) throw new Error(permError.message);
  }

  return roleIds;
}

export async function loadRolePermissions(
  supabase: SupabaseClient,
  tenantRoleId: string,
): Promise<Set<PermissionKey>> {
  const { data, error } = await supabase
    .from('tenant_role_permissions')
    .select('permission_key')
    .eq('tenant_role_id', tenantRoleId)
    .eq('granted', true);

  if (error) throw new Error(error.message);

  const keys = (data ?? []).map((r) => r.permission_key as PermissionKey);
  return expandPermissions(keys);
}

export async function getTenantRoles(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<TenantRole[]> {
  const { data, error } = await supabase
    .from('tenant_roles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order');

  if (error) throw new Error(error.message);
  return (data ?? []) as TenantRole[];
}

export async function enumRoleFromTenantRoleId(
  admin: SupabaseClient,
  tenantRoleId: string,
): Promise<'verwaltung' | 'administrator' | 'vorarbeiter' | 'mitarbeiter'> {
  const { data } = await admin.from('tenant_roles').select('slug').eq('id', tenantRoleId).single();
  if (data && SYSTEM_ROLE_SLUGS.includes(data.slug as SystemRoleSlug)) {
    return data.slug as 'verwaltung' | 'administrator' | 'vorarbeiter' | 'mitarbeiter';
  }
  return 'mitarbeiter';
}

export function slugifyRoleName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'rolle';
}
