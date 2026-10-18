import type { SupabaseClient } from '@supabase/supabase-js';
import { memberUserIdsIncludingForeman } from '@/lib/schedule/foreman-daily-report';
import { addDays } from '@/lib/schedule/week';

export type EntryForSync = {
  id: string;
  site_id: string;
  start_date: string;
  end_date: string;
  start_time: string;
  memberUserIds: string[];
  foremanUserId?: string | null;
};

/** Erster Einsatz pro Mitarbeiter und Tag → daily_assignments (für Zeiterfassung). */
export async function syncDailyAssignmentsFromSchedule(
  supabase: SupabaseClient,
  tenantId: string,
  weekStart: string,
  weekEnd: string,
  entries: EntryForSync[],
): Promise<void> {
  const byUserDay = new Map<string, { siteId: string; startTime: string }>();

  for (const entry of entries) {
    let day = entry.start_date;
    while (day <= entry.end_date && day <= weekEnd) {
      if (day >= weekStart) {
        for (const userId of memberUserIdsIncludingForeman(
          entry.memberUserIds,
          entry.foremanUserId,
        )) {
          const key = `${userId}:${day}`;
          const existing = byUserDay.get(key);
          if (!existing || entry.start_time < existing.startTime) {
            byUserDay.set(key, { siteId: entry.site_id, startTime: entry.start_time });
          }
        }
      }
      day = addDays(day, 1);
    }
  }

  const upserts = [...byUserDay.entries()].map(([key, val]) => {
    const [userId, assignmentDate] = key.split(':');
    return {
      tenant_id: tenantId,
      user_id: userId,
      site_id: val.siteId,
      assignment_date: assignmentDate,
      notes: null,
    };
  });

  if (upserts.length === 0) return;

  const { error } = await supabase.from('daily_assignments').upsert(upserts, {
    onConflict: 'tenant_id,user_id,assignment_date',
  });
  if (error) throw new Error(error.message);
}
