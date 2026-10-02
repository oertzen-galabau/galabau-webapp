import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionContext, SessionContext } from '@/lib/auth/session';
import { canAccess } from '@/lib/auth/session';
import type { UserRole } from '@/lib/types/database';

export type SiteAccessContext = Pick<
  SessionContext | ActionContext,
  'userId' | 'permissions' | 'isSuperadminBypass'
> & { tenantId: string };

function asSiteAccessContext(ctx: SessionContext | ActionContext): SiteAccessContext {
  const tenantId = 'tenantId' in ctx ? ctx.tenantId : ctx.tenant!.id;
  return {
    userId: ctx.userId,
    permissions: ctx.permissions,
    isSuperadminBypass: ctx.isSuperadminBypass,
    tenantId,
  };
}

function profileRoleOf(ctx: SessionContext | ActionContext): UserRole {
  if ('profile' in ctx) return ctx.profile.role;
  return ctx.profileRole;
}

const TENANT_WIDE_SITE_ROLES: UserRole[] = ['verwaltung', 'administrator'];

/** Mandantenweite Baustellenliste (Verwaltung, Team-Zuweisung, Superadmin). */
export function canViewAllSites(ctx: SessionContext | ActionContext): boolean {
  if (ctx.isSuperadminBypass) return true;
  if (canAccess(ctx, 'sites.assign_team')) return true;
  return TENANT_WIDE_SITE_ROLES.includes(profileRoleOf(ctx));
}

const EMPTY_SITE_ID_FILTER = ['00000000-0000-0000-0000-000000000000'];

/** Site-IDs, die der Nutzer sehen darf (Baustellen-Team + optional Verantwortlicher). */
export async function resolveAccessibleSiteIds(
  supabase: SupabaseClient,
  ctx: SessionContext | ActionContext,
): Promise<string[] | null> {
  if (canViewAllSites(ctx)) return null;

  const access = asSiteAccessContext(ctx);
  const ids = new Set<string>();

  const { data: responsibleSites } = await supabase
    .from('sites')
    .select('id')
    .eq('tenant_id', access.tenantId)
    .eq('responsible_user_id', access.userId);

  for (const row of responsibleSites ?? []) {
    ids.add(row.id);
  }

  const { data: teamSites } = await supabase
    .from('site_team_members')
    .select('site_id')
    .eq('user_id', access.userId);

  for (const row of teamSites ?? []) {
    if (row.site_id) ids.add(row.site_id);
  }

  return [...ids];
}

export async function userCanAccessSite(
  supabase: SupabaseClient,
  ctx: SessionContext | ActionContext,
  siteId: string,
): Promise<boolean> {
  if (canViewAllSites(ctx)) return true;
  const allowed = await resolveAccessibleSiteIds(supabase, ctx);
  return allowed?.includes(siteId) ?? false;
}

export async function requireSiteAccess(
  supabase: SupabaseClient,
  ctx: SessionContext | ActionContext,
  siteId: string,
): Promise<void> {
  if (!(await userCanAccessSite(supabase, ctx, siteId))) {
    throw new Error('Keine Berechtigung für diese Baustelle');
  }
}

export type SiteListFilter = {
  ids: string[] | null;
};

export function applySiteListFilter<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  filter: SiteListFilter,
): T {
  if (filter.ids === null) return query;
  if (filter.ids.length === 0) {
    return query.in('id', EMPTY_SITE_ID_FILTER);
  }
  return query.in('id', filter.ids);
}

export function applyAccessibleSiteIdFilter<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  column: 'id' | 'site_id',
  accessibleIds: string[] | null,
): T {
  if (accessibleIds === null) return query;
  if (accessibleIds.length === 0) {
    return query.in(column, EMPTY_SITE_ID_FILTER);
  }
  return query.in(column, accessibleIds);
}

export type AccessibleSiteRow = {
  id: string;
  name: string;
  default_travel_minutes?: number;
};

export async function fetchAccessibleSites(
  supabase: SupabaseClient,
  ctx: SessionContext | ActionContext,
  columns = 'id, name, default_travel_minutes',
): Promise<AccessibleSiteRow[]> {
  const ids = await resolveAccessibleSiteIds(supabase, ctx);
  let query = supabase.from('sites').select(columns).eq('is_active', true).order('name');
  query = applySiteListFilter(query, { ids });
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AccessibleSiteRow[];
}
