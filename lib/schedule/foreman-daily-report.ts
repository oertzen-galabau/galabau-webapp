import type { SupabaseClient } from '@supabase/supabase-js';
import { todayWorkDate } from '@/lib/time-tracking/work-day';

export type ScheduleEntryForemanRow = {
  id: string;
  site_id: string;
  start_date: string;
  foreman_user_id: string | null;
  siteName?: string;
  foremanName?: string;
};

export type DailyLogForemanMatch = {
  site_id: string;
  log_date: string;
  created_by: string | null;
};

/** Einsätze ohne gesetzten Vorarbeiter (Publish-Pflicht). */
export function entriesMissingForeman(entries: ScheduleEntryForemanRow[]): ScheduleEntryForemanRow[] {
  return entries.filter((e) => !e.foreman_user_id);
}

/** Einsätze mit VA, für die kein passender Tageseintrag vom VA existiert. */
export function entriesMissingForemanDailyLog(
  entries: ScheduleEntryForemanRow[],
  logs: DailyLogForemanMatch[],
): ScheduleEntryForemanRow[] {
  const logKeys = new Set(
    logs
      .filter((l) => l.created_by)
      .map((l) => `${l.site_id}:${l.log_date}:${l.created_by}`),
  );
  return entries.filter((e) => {
    if (!e.foreman_user_id) return false;
    const key = `${e.site_id}:${e.start_date}:${e.foreman_user_id}`;
    return !logKeys.has(key);
  });
}

export function formatMissingForemanError(entries: ScheduleEntryForemanRow[]): string {
  const names = entries.map((e) => e.siteName ?? 'Baustelle').join(', ');
  return `Vorarbeiter fehlt für: ${names}`;
}

export function formatMissingDailyReportError(entries: ScheduleEntryForemanRow[]): string {
  const lines = entries.map((e) => {
    const site = e.siteName ?? 'Baustelle';
    const person = e.foremanName ?? 'Vorarbeiter';
    return `${site} – ${person}`;
  });
  return `Tagesbericht fehlt: ${lines.join('; ')}`;
}

/** Vergangene Tage: Tagesbericht vor (Nach-)Veröffentlichen. Heute nicht — sonst Deadlock vor dem ersten Publish. */
export function planDateRequiresDailyLog(planDate: string, today = todayWorkDate()): boolean {
  return planDate < today;
}

export async function isPublishedPlanDate(
  supabase: SupabaseClient,
  tenantId: string,
  planDate: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('schedule_day_publications')
    .select('plan_date')
    .eq('tenant_id', tenantId)
    .eq('plan_date', planDate)
    .maybeSingle();
  return !!data;
}

export async function isUserForemanOnSiteDate(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  siteId: string,
  planDate: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('schedule_entries')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('site_id', siteId)
    .eq('start_date', planDate)
    .eq('foreman_user_id', userId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function foremanSiteIdsForDate(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  planDate: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('schedule_entries')
    .select('site_id')
    .eq('tenant_id', tenantId)
    .eq('start_date', planDate)
    .eq('foreman_user_id', userId);
  return [...new Set((data ?? []).map((row) => row.site_id as string))];
}

export async function userHasForemanDutyOnDate(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  planDate: string,
): Promise<boolean> {
  const ids = await foremanSiteIdsForDate(supabase, tenantId, userId, planDate);
  return ids.length > 0;
}

export async function loadScheduleEntriesForPlanDate(
  supabase: SupabaseClient,
  tenantId: string,
  planDate: string,
): Promise<ScheduleEntryForemanRow[]> {
  const { data, error } = await supabase
    .from('schedule_entries')
    .select('id, site_id, start_date, foreman_user_id, sites(name)')
    .eq('tenant_id', tenantId)
    .eq('start_date', planDate);
  if (error) throw new Error(error.message);

  const foremanIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.foreman_user_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const foremanNames = new Map<string, string>();
  if (foremanIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('tenant_id', tenantId)
      .in('id', foremanIds);
    for (const p of profiles ?? []) {
      foremanNames.set(p.id, `${p.first_name} ${p.last_name}`.trim());
    }
  }

  return (data ?? []).map((row) => {
    const site = row.sites as { name: string } | { name: string }[] | null;
    const siteName = Array.isArray(site) ? site[0]?.name : site?.name;
    const foremanId = row.foreman_user_id as string | null;
    return {
      id: row.id as string,
      site_id: row.site_id as string,
      start_date: row.start_date as string,
      foreman_user_id: foremanId,
      siteName,
      foremanName: foremanId ? foremanNames.get(foremanId) : undefined,
    };
  });
}

export async function loadDailyLogsForPlanDate(
  supabase: SupabaseClient,
  tenantId: string,
  planDate: string,
): Promise<DailyLogForemanMatch[]> {
  const { data, error } = await supabase
    .from('daily_logs')
    .select('site_id, log_date, created_by')
    .eq('tenant_id', tenantId)
    .eq('log_date', planDate);
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyLogForemanMatch[];
}

export async function validatePublishPlanDate(
  supabase: SupabaseClient,
  tenantId: string,
  planDate: string,
  today = todayWorkDate(),
): Promise<void> {
  const entries = await loadScheduleEntriesForPlanDate(supabase, tenantId, planDate);
  if (!entries.length) return;

  const noForeman = entriesMissingForeman(entries);
  if (noForeman.length) {
    throw new Error(formatMissingForemanError(noForeman));
  }

  if (!planDateRequiresDailyLog(planDate, today)) return;

  const logs = await loadDailyLogsForPlanDate(supabase, tenantId, planDate);
  const missingLogs = entriesMissingForemanDailyLog(entries, logs);
  if (missingLogs.length) {
    throw new Error(formatMissingDailyReportError(missingLogs));
  }
}

/** Mitglieder + optional Vorarbeiter für daily_assignments-Sync. */
export function memberUserIdsIncludingForeman(
  memberUserIds: string[],
  foremanUserId: string | null | undefined,
): string[] {
  const ids = new Set(memberUserIds);
  if (foremanUserId) ids.add(foremanUserId);
  return [...ids];
}
