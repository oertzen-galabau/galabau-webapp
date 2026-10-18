import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionContext } from '@/lib/auth/session';
import { userCanEditDailyLog } from '@/lib/documentation/report-access';
import { isUserForemanOnSiteDate } from '@/lib/schedule/foreman-daily-report';

export async function canEditExistingDailyLog(
  supabase: SupabaseClient,
  ctx: SessionContext,
  log: { site_id: string; log_date: string; created_by: string | null },
): Promise<boolean> {
  if (userCanEditDailyLog(ctx, { created_by: log.created_by })) return true;
  if (log.created_by !== ctx.userId) return false;
  return isUserForemanOnSiteDate(
    supabase,
    ctx.tenant!.id,
    ctx.userId,
    log.site_id,
    log.log_date,
  );
}
