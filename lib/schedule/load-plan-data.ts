import type { SupabaseClient } from '@supabase/supabase-js';
import {
  expandLeaveRequests,
  findEquipmentConflicts,
  findTimeConflicts,
  type ScheduleEquipmentSlot,
  type ScheduleSlot,
} from '@/lib/schedule/conflicts';
import { equipmentScheduleLabel } from '@/lib/equipment/labels';
import { leaderCodeForProfile } from '@/lib/schedule/leader-code';
import { isWeekFullyPublished } from '@/lib/schedule/day-publication';
import { addDays, mondayOfWeek, weekDaysFromMonday } from '@/lib/schedule/week';
import type { Profile, ScheduleEntry, Site, TenantWorkArea } from '@/lib/types/database';

export type ScheduleMemberRow = {
  user_id: string;
  first_name: string;
  last_name: string;
  leader_code: string | null;
};

export type ScheduleEquipmentRow = {
  equipment_id: string;
  name: string;
  license_plate: string | null;
  inventory_number: string | null;
};

export type ScheduleEntryView = ScheduleEntry & {
  site: Pick<Site, 'id' | 'name' | 'responsible_user_id' | 'street' | 'zip_code' | 'city' | 'address'>;
  foreman: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'leader_code'> | null;
  members: ScheduleMemberRow[];
  equipment: ScheduleEquipmentRow[];
  equipmentLabel: string;
  leaderLabel: string;
};

export type SchedulePlanData = {
  weekStart: string;
  weekEnd: string;
  weekDays: string[];
  entries: ScheduleEntryView[];
  /** true, wenn jeder Tag mit mindestens einem Einsatz veröffentlicht ist */
  published: boolean;
  publishedAt: string | null;
  publishedByDay: Record<string, boolean>;
  publishedAtByDay: Record<string, string | null>;
  sites: Pick<Site, 'id' | 'name' | 'responsible_user_id'>[];
  employees: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'leader_code' | 'is_active' | 'work_area_id'>[];
  workAreas: Pick<TenantWorkArea, 'id' | 'name' | 'sort_order' | 'is_active' | 'schedule_assignable'>[];
  foremen: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'leader_code'>[];
  subcontractors: { id: string; name: string; contact_person: string | null }[];
  equipment: {
    id: string;
    name: string;
    kind: string;
    license_plate: string | null;
    inventory_number: string | null;
  }[];
  leaveDays: ReturnType<typeof expandLeaveRequests>;
  timeConflicts: ReturnType<typeof findTimeConflicts>;
  equipmentConflicts: ReturnType<typeof findEquipmentConflicts>;
  scheduleConflicts: ReturnType<typeof findTimeConflicts>;
  responsibleLeaderBySiteId: Record<string, string>;
};

function normalizeTime(t: string): string {
  return t.slice(0, 5);
}

export async function loadSchedulePlanData(
  supabase: SupabaseClient,
  tenantId: string,
  weekStartInput: string | null,
): Promise<SchedulePlanData> {
  const weekStart = weekStartInput ? mondayOfWeek(weekStartInput) : mondayOfWeek(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date()),
  );
  const weekEnd = addDays(weekStart, 6);
  const weekDays = weekDaysFromMonday(weekStart);

  const [
    { data: entriesRaw, error: entriesError },
    { data: dayPublications },
    { data: sites },
    { data: employees },
    { data: foremenRoles },
    { data: leaveRows },
    { data: subcontractorsRaw },
    { data: equipmentCatalog },
    { data: workAreasRaw },
  ] = await Promise.all([
    supabase
      .from('schedule_entries')
      .select(`
        *,
        sites(id, name, responsible_user_id, street, zip_code, city, address),
        schedule_entry_members(user_id, profiles(first_name, last_name, leader_code)),
        schedule_entry_equipment(
          equipment_id,
          tenant_equipment(id, name, license_plate, inventory_number)
        )
      `)
      .eq('tenant_id', tenantId)
      .lte('start_date', weekEnd)
      .gte('end_date', weekStart)
      .order('sort_order')
      .order('start_time'),
    supabase
      .from('schedule_day_publications')
      .select('plan_date, published_at')
      .eq('tenant_id', tenantId)
      .gte('plan_date', weekStart)
      .lte('plan_date', weekEnd),
    supabase
      .from('sites')
      .select('id, name, responsible_user_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('profiles')
      .select('id, first_name, last_name, leader_code, is_active, work_area_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('last_name'),
    supabase.from('tenant_roles').select('id').eq('tenant_id', tenantId).eq('slug', 'vorarbeiter').maybeSingle(),
    supabase
      .from('leave_requests')
      .select('user_id, start_date, end_date, leave_type, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .lte('start_date', weekEnd)
      .gte('end_date', weekStart),
    supabase
      .from('tenant_business_partners')
      .select('id, name, contact_person')
      .eq('tenant_id', tenantId)
      .eq('kind', 'subcontractor')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('tenant_equipment')
      .select('id, name, kind, license_plate, inventory_number')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .neq('status', 'retired')
      .order('name'),
    supabase
      .from('tenant_work_areas')
      .select('id, name, sort_order, is_active, schedule_assignable')
      .eq('tenant_id', tenantId)
      .order('sort_order')
      .order('name'),
  ]);

  if (entriesError) {
    throw new Error(`Einsätze konnten nicht geladen werden: ${entriesError.message}`);
  }

  let foremen: Pick<Profile, 'id' | 'first_name' | 'last_name' | 'leader_code'>[] = [];
  if (foremenRoles?.id) {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, leader_code')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('tenant_role_id', foremenRoles.id)
      .order('last_name');
    foremen = data ?? [];
  }

  const responsibleIds = [...new Set((sites ?? []).map((s) => s.responsible_user_id).filter(Boolean))] as string[];
  const responsibleLeaderBySiteId: Record<string, string> = {};
  if (responsibleIds.length) {
    const { data: responsibles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, leader_code')
      .in('id', responsibleIds);
    for (const site of sites ?? []) {
      if (!site.responsible_user_id) continue;
      const p = responsibles?.find((r) => r.id === site.responsible_user_id);
      responsibleLeaderBySiteId[site.id] = leaderCodeForProfile(p ?? null);
    }
  }

  const entries: ScheduleEntryView[] = (entriesRaw ?? []).map((row) => {
    const siteRaw = row.sites as
      | Pick<Site, 'id' | 'name' | 'responsible_user_id' | 'street' | 'zip_code' | 'city' | 'address'>
      | Pick<Site, 'id' | 'name' | 'responsible_user_id' | 'street' | 'zip_code' | 'city' | 'address'>[]
      | null;
    const site = Array.isArray(siteRaw) ? siteRaw[0] : siteRaw;
    const foreman = row.foreman_user_id
      ? (employees ?? []).find((e) => e.id === row.foreman_user_id) ?? foremen.find((e) => e.id === row.foreman_user_id) ?? null
      : null;
    const memberRows = (row.schedule_entry_members ?? []) as {
      user_id: string;
      profiles: ScheduleMemberRow | ScheduleMemberRow[] | null;
    }[];
    const members: ScheduleMemberRow[] = memberRows.map((m) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return {
        user_id: m.user_id,
        first_name: p?.first_name ?? '',
        last_name: p?.last_name ?? '',
        leader_code: p?.leader_code ?? null,
      };
    });
    const leaderLabel = foreman
      ? leaderCodeForProfile(foreman)
      : (site?.id ? responsibleLeaderBySiteId[site.id] : '—') ?? '—';

    const equipmentRows = (row.schedule_entry_equipment ?? []) as {
      equipment_id: string;
      tenant_equipment: ScheduleEquipmentRow | ScheduleEquipmentRow[] | null;
    }[];
    const equipment: ScheduleEquipmentRow[] = equipmentRows.map((link) => {
      const raw = link.tenant_equipment;
      const eq = Array.isArray(raw) ? raw[0] : raw;
      return {
        equipment_id: link.equipment_id,
        name: eq?.name ?? '—',
        license_plate: eq?.license_plate ?? null,
        inventory_number: eq?.inventory_number ?? null,
      };
    });
    const equipmentLabel = equipment
      .map((eq) => equipmentScheduleLabel(eq))
      .join(', ');

    const entryBase = { ...row } as Record<string, unknown>;
    delete entryBase.sites;
    delete entryBase.schedule_entry_members;
    delete entryBase.schedule_entry_equipment;
    const entry = entryBase as ScheduleEntry;
    return {
      ...entry,
      start_time: normalizeTime(entry.start_time),
      end_time: normalizeTime(entry.end_time),
      site: site ?? {
        id: entry.site_id,
        name: '—',
        responsible_user_id: null,
        street: null,
        zip_code: null,
        city: null,
        address: null,
      },
      foreman,
      members,
      equipment,
      equipmentLabel,
      leaderLabel,
    };
  });

  const leaveDays = expandLeaveRequests(leaveRows ?? []);

  const slots: ScheduleSlot[] = [];
  const equipmentSlots: ScheduleEquipmentSlot[] = [];
  for (const entry of entries) {
    for (const m of entry.members) {
      slots.push({
        entryId: entry.id,
        userId: m.user_id,
        startDate: entry.start_date,
        endDate: entry.end_date,
        startTime: entry.start_time,
        endTime: entry.end_time,
      });
    }
    for (const eq of entry.equipment) {
      equipmentSlots.push({
        entryId: entry.id,
        equipmentId: eq.equipment_id,
        startDate: entry.start_date,
        endDate: entry.end_date,
        startTime: entry.start_time,
        endTime: entry.end_time,
      });
    }
  }

  const timeConflicts = findTimeConflicts(slots);
  const equipmentConflicts = findEquipmentConflicts(equipmentSlots);

  const publishedAtByDay: Record<string, string | null> = {};
  const publishedByDay: Record<string, boolean> = {};
  for (const day of weekDays) {
    publishedByDay[day] = false;
    publishedAtByDay[day] = null;
  }
  for (const row of dayPublications ?? []) {
    publishedByDay[row.plan_date] = true;
    publishedAtByDay[row.plan_date] = row.published_at ?? null;
  }

  const daysWithEntries = [...new Set(entries.map((e) => e.start_date))];
  const published = isWeekFullyPublished(daysWithEntries, publishedByDay);

  const publishedAt =
    [...daysWithEntries]
      .map((d) => publishedAtByDay[d])
      .filter(Boolean)
      .sort()
      .pop() ?? null;

  return {
    weekStart,
    weekEnd,
    weekDays,
    entries,
    published,
    publishedAt,
    publishedByDay,
    publishedAtByDay,
    sites: sites ?? [],
    employees: employees ?? [],
    workAreas: workAreasRaw ?? [],
    foremen,
    subcontractors: subcontractorsRaw ?? [],
    equipment: equipmentCatalog ?? [],
    leaveDays,
    timeConflicts,
    equipmentConflicts,
    scheduleConflicts: [...timeConflicts, ...equipmentConflicts],
    responsibleLeaderBySiteId,
  };
}

export async function loadScheduleDayData(
  supabase: SupabaseClient,
  tenantId: string,
  day: string,
): Promise<{ day: string; entries: ScheduleEntryView[] }> {
  const plan = await loadSchedulePlanData(supabase, tenantId, mondayOfWeek(day));
  const entries = plan.entries.filter((e) => e.start_date === day);
  return { day, entries };
}
