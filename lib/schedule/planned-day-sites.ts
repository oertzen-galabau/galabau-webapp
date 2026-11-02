import type { SupabaseClient } from '@supabase/supabase-js';
import { memberUserIdsIncludingForeman } from '@/lib/schedule/foreman-daily-report';

export type PlannedDaySite = {
  siteId: string;
  siteName: string;
  defaultTravelMinutes: number;
};

type ScheduleRow = {
  site_id: string;
  foreman_user_id: string | null;
  schedule_entry_members: { user_id: string }[] | null;
  sites:
    | { name: string; default_travel_minutes: number }
    | { name: string; default_travel_minutes: number }[]
    | null;
};

function siteFromRow(row: ScheduleRow): PlannedDaySite | null {
  const raw = row.sites;
  if (!raw) return null;
  const site = Array.isArray(raw) ? raw[0] : raw;
  if (!site) return null;
  return {
    siteId: row.site_id,
    siteName: site.name,
    defaultTravelMinutes: site.default_travel_minutes ?? 0,
  };
}

/** Alle Baustellen aus heutigen Einsatzplan-Einträgen des Mitarbeiters (dedupliziert). */
export async function getPlannedDaySitesForUser(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  workDate: string,
): Promise<PlannedDaySite[]> {
  const { data, error } = await supabase
    .from('schedule_entries')
    .select(
      'site_id, foreman_user_id, schedule_entry_members(user_id), sites(name, default_travel_minutes)',
    )
    .eq('tenant_id', tenantId)
    .lte('start_date', workDate)
    .gte('end_date', workDate);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ScheduleRow[];

  const bySiteId = new Map<string, PlannedDaySite>();
  for (const row of rows) {
    const memberIds = memberUserIdsIncludingForeman(
      (row.schedule_entry_members ?? []).map((m) => m.user_id),
      row.foreman_user_id,
    );
    if (!memberIds.includes(userId)) continue;

    const site = siteFromRow(row);
    if (!site) continue;
    if (!bySiteId.has(site.siteId)) {
      bySiteId.set(site.siteId, site);
    }
  }

  return [...bySiteId.values()].sort((a, b) => a.siteName.localeCompare(b.siteName, 'de'));
}
