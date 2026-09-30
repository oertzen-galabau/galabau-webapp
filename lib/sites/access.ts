import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionContext, SessionContext } from '@/lib/auth/session';
import { canAccess } from '@/lib/auth/session';

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
import { todayWorkDate } from '@/lib/time-tracking/work-day';

/** Voller Zugriff auf alle Baustellen (Verwaltung/Administrator). */
export function canViewAllSites(ctx: SessionContext | ActionContext): boolean {
  if (ctx.isSuperadminBypass) return true;
  return canAccess(ctx, 'nav.team') || canAccess(ctx, 'urlaub.view_all');
}

/** Site-IDs, die der Nutzer sehen darf (Einteilungen ab heute + ggf. VA-Zuständigkeit). */
export async function resolveAccessibleSiteIds(
  supabase: SupabaseClient,
  ctx: SessionContext | ActionContext,
): Promise<string[] | null> {
  if (canViewAllSites(ctx)) return null;

  const access = asSiteAccessContext(ctx);
  const today = todayWorkDate();
  const ids = new Set<string>();

  const { data: assignments } = await supabase
    .from('daily_assignments')
    .select('site_id')
    .eq('user_id', access.userId)
    .gte('assignment_date', today);

  for (const row of assignments ?? []) {
    if (row.site_id) ids.add(row.site_id);
  }

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

export type SiteListFilter = {
  ids: string[] | null;
};

export function applySiteListFilter<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  filter: SiteListFilter,
): T {
  if (filter.ids === null) return query;
  if (filter.ids.length === 0) {
    return query.in('id', ['00000000-0000-0000-0000-000000000000']);
  }
  return query.in('id', filter.ids);
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
  if (ids !== null) {
    if (ids.length === 0) return [];
    query = query.in('id', ids);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AccessibleSiteRow[];
}
