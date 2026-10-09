import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionContext, SessionContext } from '@/lib/auth/session';
import { canAccess } from '@/lib/auth/session';

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
