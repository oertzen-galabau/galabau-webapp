import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionContext, SessionContext } from '@/lib/auth/session';
import { canAccess } from '@/lib/auth/session';
import { isUserForemanOnSiteDate } from '@/lib/schedule/foreman-daily-report';
import { userCanCreateDailyReportOnSite } from '@/lib/sites/access';

export type ReportAccessContext = Pick<
  SessionContext | ActionContext,
  'userId' | 'permissions' | 'isSuperadminBypass'
>;

export function canViewAllReports(ctx: SessionContext | ActionContext): boolean {
  if (ctx.isSuperadminBypass) return true;
  return canAccess(ctx, 'documentation.view_all');
}

const EMPTY_DAILY_LOG_FILTER = ['00000000-0000-0000-0000-000000000000'];

/**
 * IDs der eigenen daily_logs (null = keine Einschränkung).
 * Leeres Array bedeutet: bewusst keine Treffer (sentinel-IDs verwenden).
 */
export async function resolveOwnedDailyLogIds(
  supabase: SupabaseClient,
  ctx: SessionContext | ActionContext,
  tenantId: string,
  options: { siteId?: string } = {},
): Promise<string[] | null> {
  if (canViewAllReports(ctx)) return null;

  let query = supabase
    .from('daily_logs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('created_by', ctx.userId);
  if (options.siteId) {
    query = query.eq('site_id', options.siteId);
  }
  const { data } = await query;
  const ids = (data ?? []).map((row) => row.id);
  return ids.length > 0 ? ids : [...EMPTY_DAILY_LOG_FILTER];
}

export type DailyLogOwnershipRow = {
  created_by: string | null;
  tenant_id?: string;
};

/** Darf der Nutzer diesen Tagesbericht ansehen (PDF, Liste)? */
export function userCanViewDailyLog(
  ctx: SessionContext | ActionContext,
  log: DailyLogOwnershipRow,
): boolean {
  if (canViewAllReports(ctx)) return true;
  if (!log.created_by) return false;
  return log.created_by === ctx.userId;
}

export type ReportOwnershipRow = {
  created_by?: string | null;
  daily_log?: DailyLogOwnershipRow | null;
};

/** PDF-Zugriff: primär Ersteller des daily_log, sonst Ersteller des reports (Altfälle). */
export function userCanViewReport(
  ctx: SessionContext | ActionContext,
  report: ReportOwnershipRow,
): boolean {
  if (canViewAllReports(ctx)) return true;
  const logOwner = report.daily_log?.created_by ?? null;
  if (logOwner) return logOwner === ctx.userId;
  const reportOwner = report.created_by ?? null;
  if (!reportOwner) return false;
  return reportOwner === ctx.userId;
}

/** Darf der Nutzer diesen Tagesbericht bearbeiten? (gleiche Regel wie Ansehen + documentation.manage) */
export function userCanEditDailyLog(
  ctx: SessionContext | ActionContext,
  log: DailyLogOwnershipRow,
): boolean {
  if (!canAccess(ctx, 'documentation.manage')) return false;
  return userCanViewDailyLog(ctx, log);
}

function tenantIdOf(ctx: SessionContext | ActionContext): string {
  return 'tenantId' in ctx ? ctx.tenantId : ctx.tenant!.id;
}

/** Anlegen oder Bearbeiten inkl. Einsatz-Vorarbeiter ohne Dauer-Recht documentation.manage. */
export async function canManageDailyReportForSiteDate(
  supabase: SupabaseClient,
  ctx: SessionContext | ActionContext,
  siteId: string,
  logDate: string,
  existingLog?: DailyLogOwnershipRow | null,
): Promise<boolean> {
  if (existingLog) {
    if (userCanEditDailyLog(ctx, existingLog)) return true;
    if (existingLog.created_by === ctx.userId) {
      return isUserForemanOnSiteDate(supabase, tenantIdOf(ctx), ctx.userId, siteId, logDate);
    }
    return false;
  }

  if (canAccess(ctx, 'documentation.manage')) {
    return userCanCreateDailyReportOnSite(supabase, ctx, siteId, logDate);
  }

  return isUserForemanOnSiteDate(supabase, tenantIdOf(ctx), ctx.userId, siteId, logDate);
}

export async function requireCanManageDailyReportForSiteDate(
  supabase: SupabaseClient,
  ctx: SessionContext | ActionContext,
  siteId: string,
  logDate: string,
  existingLog?: DailyLogOwnershipRow | null,
): Promise<void> {
  if (!(await canManageDailyReportForSiteDate(supabase, ctx, siteId, logDate, existingLog))) {
    throw new Error('Keine Berechtigung für diesen Tagesbericht');
  }
}
