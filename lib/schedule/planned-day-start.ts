import type { SupabaseClient } from '@supabase/supabase-js';
import { memberUserIdsIncludingForeman } from '@/lib/schedule/foreman-daily-report';

export type PlannedDayStart = {
  scheduleEntryId: string;
  siteId: string;
  plannedStartTime: string;
  plannedEndTime: string;
  siteName: string | null;
};

type ScheduleRow = {
  id: string;
  site_id: string;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string;
  foreman_user_id: string | null;
  schedule_entry_members: { user_id: string }[] | null;
  sites: { name: string } | { name: string }[] | null;
};

function siteNameFromRow(row: ScheduleRow): string | null {
  const raw = row.sites;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0]?.name ?? null;
  return raw.name ?? null;
}

/** Frühester Einsatz des MA am Tag (gleiche Logik wie daily_assignments-Sync). */
export async function getPlannedDayStartForUser(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  workDate: string,
): Promise<PlannedDayStart | null> {
  const { data, error } = await supabase
    .from('schedule_entries')
    .select(
      'id, site_id, start_time, end_time, start_date, end_date, foreman_user_id, schedule_entry_members(user_id), sites(name)',
    )
    .eq('tenant_id', tenantId)
    .lte('start_date', workDate)
    .gte('end_date', workDate);

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ScheduleRow[];

  let bestStartEntry: ScheduleRow | null = null;
  let latestEndTime = '';

  for (const row of rows) {
    const memberIds = memberUserIdsIncludingForeman(
      (row.schedule_entry_members ?? []).map((m) => m.user_id),
      row.foreman_user_id,
    );
    if (!memberIds.includes(userId)) continue;

    if (!bestStartEntry || row.start_time < bestStartEntry.start_time) {
      bestStartEntry = row;
    }
    if (!latestEndTime || row.end_time > latestEndTime) {
      latestEndTime = row.end_time;
    }
  }

  if (!bestStartEntry) return null;

  return {
    scheduleEntryId: bestStartEntry.id,
    siteId: bestStartEntry.site_id,
    plannedStartTime: bestStartEntry.start_time,
    plannedEndTime: latestEndTime,
    siteName: siteNameFromRow(bestStartEntry),
  };
}

function timeToMinutes(value: string): number {
  const parts = value.trim().slice(0, 8).split(':');
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + m;
}

export function isStartBeforePlannedWithTolerance(
  actualTime: string,
  plannedTime: string,
  toleranceMinutes: number,
): boolean {
  const actual = timeToMinutes(actualTime);
  const planned = timeToMinutes(plannedTime);
  return actual < planned - Math.max(0, toleranceMinutes);
}

/** Clock-in strictly after the planned window end (no start tolerance). */
export function isStartAfterPlannedEnd(actualTime: string, plannedEndTime: string): boolean {
  return timeToMinutes(actualTime) > timeToMinutes(plannedEndTime);
}

/** Clock-out after planned end plus tolerance. */
export function isEndAfterPlannedEndWithTolerance(
  actualTime: string,
  plannedEndTime: string,
  toleranceMinutes: number,
): boolean {
  const actual = timeToMinutes(actualTime);
  const plannedEnd = timeToMinutes(plannedEndTime);
  return actual > plannedEnd + Math.max(0, toleranceMinutes);
}

export const EARLY_START_REASON_MIN_LENGTH = 10;
export const OUTSIDE_PLAN_REASON_MIN_LENGTH = EARLY_START_REASON_MIN_LENGTH;
