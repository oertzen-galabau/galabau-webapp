import type { SupabaseClient } from '@supabase/supabase-js';
import { allowedWidgetIds } from '@/lib/infoboard/widgets';
import { resolveEffectiveLayout } from '@/lib/infoboard/layout';
import type {
  EquipmentUvvRow,
  InfoboardWidgetData,
  MyLeaveRow,
  PendingApprovalRow,
  PendingLeaveRow,
} from '@/lib/infoboard/types';
import {
  compareUvvDueEntries,
  EQUIPMENT_KIND_LABELS,
  equipmentListSubtitle,
  uvvUrgency,
} from '@/lib/equipment/labels';
import type { TenantEquipmentKind } from '@/lib/types/database';
import { formatLeaveType } from '@/lib/leave/labels';
import {
  listMyLeaveRequestsForInfoboard,
  listPendingLeavePreview,
} from '@/lib/leave/queries';
import { businessDaysBetween } from '@/lib/utils/time';
import type { PermissionKey } from '@/lib/auth/permissions';
import type { SessionContext } from '@/lib/auth/session';
import { canAccess } from '@/lib/auth/session';
import { approvalEmptyQuip } from '@/lib/time-tracking/approval-empty-quips';
import {
  buildScheduleRowsForDay,
  formatScheduleDayLabel,
  type InfoboardAppointmentRaw,
  type InfoboardScheduleEntryRaw,
} from '@/lib/infoboard/schedule-rows';
import { addDays } from '@/lib/schedule/week';
import {
  currentHour,
  endOfWeekDate,
  greetingForHour,
  startOfWeekDate,
  todayWorkDate,
} from '@/lib/time-tracking/work-day';

const INFOBOARD_SCHEDULE_SELECT =
  'id, start_time, end_time, site_id, foreman_user_id, external_workers_text, sites(name, address), schedule_entry_members(user_id, profiles(first_name, last_name))';

type ProfileRef = { first_name: string; last_name: string };
type SiteRef = { name: string; address: string | null };

function asProfile(value: unknown): ProfileRef | null {
  if (!value || Array.isArray(value)) return null;
  const profile = value as ProfileRef;
  return profile.first_name ? profile : null;
}

function asSiteRef(value: unknown): SiteRef | null {
  if (!value || Array.isArray(value)) return null;
  const site = value as SiteRef;
  return site.name ? site : null;
}

export type InfoboardPagePayload = {
  layout: ReturnType<typeof resolveEffectiveLayout>;
  allowedWidgetIds: ReturnType<typeof allowedWidgetIds>;
  canCustomize: boolean;
  widgetData: InfoboardWidgetData;
};

export async function fetchInfoboardPayload(
  ctx: SessionContext,
  supabase: SupabaseClient,
): Promise<InfoboardPagePayload> {
  const today = todayWorkDate();
  const tomorrow = addDays(today, 1);
  const tenantId = ctx.tenant?.id;
  if (!tenantId) {
    throw new Error('Kein Mandant');
  }
  const canApprove = canAccess(ctx, 'zeiten.approve');
  const canViewPosts = canAccess(ctx, 'nav.infoboard');
  const canManagePosts = canAccess(ctx, 'infoboard.posts');
  const canApproveLeave = canAccess(ctx, 'urlaub.approve');
  const canRequestLeave = canAccess(ctx, 'urlaub.request');
  const canViewEquipment =
    canAccess(ctx, 'nav.partners') && canAccess(ctx, 'partners.view');
  const equipmentUvvPreviewLimit = 10;
  const now = new Date();
  const recentLeaveCutoff = new Date(now);
  recentLeaveCutoff.setDate(recentLeaveCutoff.getDate() - 14);
  const recentLeaveCutoffIso = recentLeaveCutoff.toISOString();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const weekStart = startOfWeekDate(today);
  const weekEnd = endOfWeekDate(today);
  const dayStart = `${today}T00:00:00`;
  const dayEnd = `${today}T23:59:59`;
  const tomorrowDayStart = `${tomorrow}T00:00:00`;
  const tomorrowDayEnd = `${tomorrow}T23:59:59`;
  const canViewSchedule = canAccess(ctx, 'schedule.view');

  const [
    { data: profileRow },
    { data: rejectedTimeEntries },
    { data: todayEntries },
    { data: activeProfiles },
    { data: activeSites },
    { data: completedSites },
    { data: startingSites },
    { data: openReports },
    { data: appointments },
    { data: todayScheduleEntries },
    { data: tomorrowScheduleEntries },
    { data: myAssignment },
    { data: myAssignmentTomorrow },
    { data: tomorrowAppointments },
    { data: pendingPreview },
    { count: pendingCount },
    { data: posts },
    leavePendingPreviewResult,
    { count: leavePendingCount },
    myLeaveRequestsResult,
    { data: equipmentWithUvv },
    { data: readInfoboardPosts },
  ] = await Promise.all([
    supabase.from('profiles').select('dashboard_layout').eq('id', ctx.userId).single(),
    supabase
      .from('time_entries')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', ctx.userId)
      .eq('approval_status', 'rejected'),
    supabase
      .from('time_entries')
      .select('work_minutes, user_id, end_time')
      .eq('tenant_id', tenantId)
      .eq('work_date', today),
    supabase.from('profiles').select('id').eq('tenant_id', tenantId).eq('is_active', true),
    supabase.from('sites').select('id').eq('tenant_id', tenantId).eq('is_active', true),
    supabase
      .from('sites')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('end_date', monthStart)
      .lte('end_date', today),
    supabase
      .from('sites')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .gte('start_date', weekStart)
      .lte('start_date', weekEnd),
    supabase
      .from('reports')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .in('status', ['draft', 'final'])
      .is('sent_at', null),
    supabase
      .from('site_appointments')
      .select('id, title, appointment_at, site_id, sites(name, address)')
      .eq('tenant_id', tenantId)
      .gte('appointment_at', dayStart)
      .lte('appointment_at', dayEnd)
      .order('appointment_at'),
    canViewSchedule
      ? supabase
          .from('schedule_entries')
          .select(INFOBOARD_SCHEDULE_SELECT)
          .eq('tenant_id', tenantId)
          .lte('start_date', today)
          .gte('end_date', today)
          .order('start_time')
      : Promise.resolve({ data: [] }),
    canViewSchedule
      ? supabase
          .from('schedule_entries')
          .select(INFOBOARD_SCHEDULE_SELECT)
          .eq('tenant_id', tenantId)
          .lte('start_date', tomorrow)
          .gte('end_date', tomorrow)
          .order('start_time')
      : Promise.resolve({ data: [] }),
    supabase
      .from('daily_assignments')
      .select('site_id, sites(name, address)')
      .eq('tenant_id', tenantId)
      .eq('user_id', ctx.userId)
      .eq('assignment_date', today)
      .maybeSingle(),
    supabase
      .from('daily_assignments')
      .select('site_id, sites(name, address)')
      .eq('tenant_id', tenantId)
      .eq('user_id', ctx.userId)
      .eq('assignment_date', tomorrow)
      .maybeSingle(),
    supabase
      .from('site_appointments')
      .select('id, title, appointment_at, site_id, sites(name, address)')
      .eq('tenant_id', tenantId)
      .gte('appointment_at', tomorrowDayStart)
      .lte('appointment_at', tomorrowDayEnd)
      .order('appointment_at'),
    canApprove
      ? supabase
          .from('time_entries')
          .select('id, work_date, work_minutes, profiles(first_name, last_name)')
          .eq('tenant_id', tenantId)
          .eq('approval_status', 'pending')
          .order('submitted_at', { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
    canApprove
      ? supabase
          .from('time_entries')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('approval_status', 'pending')
      : Promise.resolve({ count: 0 }),
    canViewPosts
      ? supabase
          .from('infoboard_posts')
          .select('id, title, content, post_type, published_at, created_at')
          .eq('tenant_id', tenantId)
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
    canApproveLeave
      ? listPendingLeavePreview(supabase, tenantId, 5)
      : Promise.resolve({ data: [], error: null }),
    canApproveLeave
      ? supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    canRequestLeave
      ? listMyLeaveRequestsForInfoboard(supabase, tenantId, ctx.userId, 20)
      : Promise.resolve({ data: [], error: null }),
    canViewEquipment
      ? supabase
          .from('tenant_equipment')
          .select('id, name, kind, license_plate, inventory_number, uvv_due_date')
          .eq('tenant_id', tenantId)
          .not('uvv_due_date', 'is', null)
      : Promise.resolve({ data: [] }),
    canViewPosts
      ? supabase
          .from('infoboard_post_reads')
          .select('post_id')
          .eq('tenant_id', tenantId)
          .eq('user_id', ctx.userId)
      : Promise.resolve({ data: [] }),
  ]);

  const leavePendingPreview = leavePendingPreviewResult.data;
  const myLeaveRequests = myLeaveRequestsResult.data;

  const totalMinutesToday = (todayEntries ?? []).reduce((sum, e) => sum + (e.work_minutes ?? 0), 0);
  const ownMinutesToday = (todayEntries ?? [])
    .filter((e) => e.user_id === ctx.userId)
    .reduce((sum, e) => sum + (e.work_minutes ?? 0), 0);
  const activeWorkers = (todayEntries ?? []).filter((e) => !e.end_time).length;
  const totalWorkers = activeProfiles?.length ?? 0;
  const showTeamTimeStats = canAccess(ctx, 'zeiten.view_all');
  const showActiveWorkersLine = canAccess(ctx, 'zeiten.approve');
  const pendingReports = (openReports ?? []).filter((r) => r.status === 'draft').length;
  const rejectedCount = rejectedTimeEntries?.length ?? 0;
  const totalPending = pendingCount ?? 0;

  const canSeeAllInfoboardSchedule = canAccess(ctx, 'infoboard.schedule_all');

  const { data: todayDailyLogs } = await supabase
    .from('daily_logs')
    .select('site_id, created_by')
    .eq('tenant_id', tenantId)
    .eq('log_date', today);

  const foremanLogKeys = new Set(
    (todayDailyLogs ?? [])
      .filter((row) => row.created_by)
      .map((row) => `${row.site_id}:${row.created_by}`),
  );

  const scheduleBuildBase = {
    userId: ctx.userId,
    canSeeAll: canSeeAllInfoboardSchedule,
  };

  const todayScheduleRows = buildScheduleRowsForDay({
    ...scheduleBuildBase,
    dayIso: today,
    entries: (todayScheduleEntries ?? []) as InfoboardScheduleEntryRaw[],
    appointments: (appointments ?? []) as InfoboardAppointmentRaw[],
    assignment: myAssignment,
    foremanLogKeys,
    includeMissingReport: true,
    emptyMessage: 'Keine Einsätze für heute geplant.',
  });

  const tomorrowScheduleRows = buildScheduleRowsForDay({
    ...scheduleBuildBase,
    dayIso: tomorrow,
    entries: (tomorrowScheduleEntries ?? []) as InfoboardScheduleEntryRaw[],
    appointments: (tomorrowAppointments ?? []) as InfoboardAppointmentRaw[],
    assignment: myAssignmentTomorrow,
    includeMissingReport: false,
    emptyMessage: 'Keine Einsätze für morgen geplant.',
  });

  const pendingLeaveRows: PendingLeaveRow[] = (leavePendingPreview ?? []).map((req) => {
    const profile = asProfile(req.profiles);
    return {
      id: req.id,
      name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unbekannt',
      leaveTypeLabel: formatLeaveType(req.leave_type, req.notes),
      startDate: req.start_date,
      endDate: req.end_date,
      businessDays: businessDaysBetween(req.start_date, req.end_date),
    };
  });

  const totalLeavePending = leavePendingCount ?? 0;

  const myLeaveRows: MyLeaveRow[] = (myLeaveRequests ?? [])
    .filter(
      (req) =>
        req.status === 'pending'
        || (req.reviewed_at != null && req.reviewed_at >= recentLeaveCutoffIso),
    )
    .slice(0, 8)
    .map((req) => ({
      id: req.id,
      leaveTypeLabel: formatLeaveType(req.leave_type, req.notes),
      startDate: req.start_date,
      endDate: req.end_date,
      status: req.status as MyLeaveRow['status'],
      businessDays: businessDaysBetween(req.start_date, req.end_date),
    }))
    .sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (b.status === 'pending' && a.status !== 'pending') return 1;
      return 0;
    });

  const equipmentUvvSorted: EquipmentUvvRow[] = (equipmentWithUvv ?? [])
    .map((row) => {
      const dueDate = String(row.uvv_due_date);
      const urgency = uvvUrgency(dueDate, today);
      if (!urgency) return null;
      const kind = row.kind as TenantEquipmentKind;
      return {
        id: row.id,
        name: row.name,
        kindLabel: EQUIPMENT_KIND_LABELS[kind] ?? row.kind,
        subtitle: equipmentListSubtitle(row),
        dueDate,
        urgency,
      };
    })
    .filter((row): row is EquipmentUvvRow => row != null)
    .sort((a, b) =>
      compareUvvDueEntries(
        { uvvDueDate: a.dueDate, urgency: a.urgency },
        { uvvDueDate: b.dueDate, urgency: b.urgency },
      ),
    );

  const equipmentUvvTotal = equipmentUvvSorted.length;
  const equipmentUvvRows = equipmentUvvSorted.slice(0, equipmentUvvPreviewLimit);

  const pendingRows: PendingApprovalRow[] = (pendingPreview ?? []).map((entry) => {
    const profile = asProfile(entry.profiles);
    return {
      id: entry.id,
      workDate: entry.work_date,
      workMinutes: entry.work_minutes,
      name: profile ? `${profile.first_name} ${profile.last_name}` : 'Unbekannt',
    };
  });

  const permissions = ctx.permissions as Set<PermissionKey>;
  const layout = resolveEffectiveLayout(
    profileRow?.dashboard_layout,
    permissions,
    ctx.isSuperadminBypass,
  );

  const readInfoboardPostIds = new Set((readInfoboardPosts ?? []).map((row) => row.post_id));

  const infoboardPostRows = (posts ?? []).map((post) => ({
    id: post.id,
    title: post.title,
    content: post.content,
    postType: post.post_type,
    publishedAt: post.published_at,
    createdAt: post.created_at,
    isUnread: !readInfoboardPostIds.has(post.id),
  }));

  const greeting = greetingForHour(currentHour());
  const firstName = ctx.profile.first_name || 'Team';
  const dateLabel = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(now);

  return {
    layout,
    allowedWidgetIds: allowedWidgetIds(permissions, ctx.isSuperadminBypass),
    canCustomize: canAccess(ctx, 'infoboard.customize'),
    widgetData: {
      greeting,
      firstName,
      dateLabel,
      subtitle: showActiveWorkersLine
        ? activeWorkers > 0
          ? `${activeWorkers} Mitarbeitende sind heute aktiv.`
          : 'Dein Betrieb ist bereit — Starte die Zeit oben im Header.'
        : showTeamTimeStats
          ? 'Übersicht der erfassten Zeiten im Betrieb.'
          : ownMinutesToday > 0
            ? 'Deine Zeiten für heute sind erfasst.'
            : 'Starte die Zeiterfassung oben im Header.',
      rejectedCount,
      pendingApproval: {
        rows: pendingRows,
        totalPending,
        emptyQuip: approvalEmptyQuip(today),
      },
      metrics: {
        totalMinutesToday,
        activeWorkers,
        totalWorkers,
        activeSites: activeSites?.length ?? 0,
        startingSitesThisWeek: startingSites?.length ?? 0,
        completedSitesThisMonth: completedSites?.length ?? 0,
        openReports: openReports?.length ?? 0,
        pendingReports,
      },
      schedule: {
        today: {
          dateLabel: formatScheduleDayLabel(today),
          dayIso: today,
          rows: todayScheduleRows,
        },
        tomorrow: {
          dateLabel: formatScheduleDayLabel(tomorrow),
          dayIso: tomorrow,
          rows: tomorrowScheduleRows,
        },
      },
      posts: infoboardPostRows,
      latestUnreadPost: infoboardPostRows.find((post) => post.isUnread) ?? null,
      canManagePosts,
      leavePending: {
        rows: pendingLeaveRows,
        totalPending: totalLeavePending,
      },
      leaveMine: { rows: myLeaveRows },
      showTeamTimeStats,
      showActiveWorkersLine,
      ownMinutesToday,
      equipmentUvvDue: {
        rows: equipmentUvvRows,
        totalCount: equipmentUvvTotal,
      },
    },
  };
}
