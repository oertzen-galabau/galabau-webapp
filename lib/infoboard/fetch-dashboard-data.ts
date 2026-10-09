import type { SupabaseClient } from '@supabase/supabase-js';
import { allowedWidgetIds } from '@/lib/infoboard/widgets';
import { resolveEffectiveLayout } from '@/lib/infoboard/layout';
import type {
  InfoboardWidgetData,
  MyLeaveRow,
  PendingApprovalRow,
  PendingLeaveRow,
  ScheduleRow,
} from '@/lib/infoboard/types';
import { formatLeaveType } from '@/lib/leave/labels';
import { businessDaysBetween } from '@/lib/utils/time';
import type { PermissionKey } from '@/lib/auth/permissions';
import type { SessionContext } from '@/lib/auth/session';
import { canAccess } from '@/lib/auth/session';
import { approvalEmptyQuip } from '@/lib/time-tracking/approval-empty-quips';
import {
  currentHour,
  endOfWeekDate,
  greetingForHour,
  startOfWeekDate,
  todayWorkDate,
} from '@/lib/time-tracking/work-day';

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

function formatAppointmentTime(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date(iso));
}

function appointmentTone(iso: string): ScheduleRow['tone'] {
  const now = Date.now();
  const time = new Date(iso).getTime();
  const diffHours = (time - now) / (1000 * 60 * 60);
  if (diffHours <= 0 && diffHours > -4) return 'active';
  if (diffHours > 0 && diffHours <= 2) return 'travel';
  return 'planned';
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
  const tenantId = ctx.tenant?.id;
  if (!tenantId) {
    throw new Error('Kein Mandant');
  }
  const canApprove = canAccess(ctx, 'zeiten.approve');
  const canViewPosts = canAccess(ctx, 'nav.infoboard');
  const canManagePosts = canAccess(ctx, 'infoboard.posts');
  const canApproveLeave = canAccess(ctx, 'urlaub.approve');
  const canRequestLeave = canAccess(ctx, 'urlaub.request');
  const canViewMessages = canAccess(ctx, 'nav.nachrichten');
  const now = new Date();
  const recentLeaveCutoff = new Date(now);
  recentLeaveCutoff.setDate(recentLeaveCutoff.getDate() - 14);
  const recentLeaveCutoffIso = recentLeaveCutoff.toISOString();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const weekStart = startOfWeekDate(today);
  const weekEnd = endOfWeekDate(today);
  const dayStart = `${today}T00:00:00`;
  const dayEnd = `${today}T23:59:59`;

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
    { data: myAssignment },
    { data: pendingPreview },
    { count: pendingCount },
    { data: posts },
    { data: leavePendingPreview },
    { count: leavePendingCount },
    { data: myLeaveRequests },
    { count: unreadMessagesCount },
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
    supabase
      .from('daily_assignments')
      .select('site_id, sites(name, address)')
      .eq('tenant_id', tenantId)
      .eq('user_id', ctx.userId)
      .eq('assignment_date', today)
      .maybeSingle(),
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
          .limit(5)
      : Promise.resolve({ data: [] }),
    canApproveLeave
      ? supabase
          .from('leave_requests')
          .select('id, leave_type, start_date, end_date, notes, profiles(first_name, last_name)')
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
    canApproveLeave
      ? supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    canRequestLeave
      ? supabase
          .from('leave_requests')
          .select('id, leave_type, start_date, end_date, notes, status, reviewed_at, created_at')
          .eq('tenant_id', tenantId)
          .eq('user_id', ctx.userId)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    canViewMessages
      ? supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('recipient_id', ctx.userId)
          .is('read_at', null)
      : Promise.resolve({ count: 0 }),
  ]);

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

  const scheduleRows: ScheduleRow[] = (appointments ?? []).map((a) => {
    const site = asSiteRef(a.sites);
    return {
      id: a.id,
      time: formatAppointmentTime(a.appointment_at),
      title: a.title || site?.name || 'Termin',
      place: site?.address ?? '—',
      tone: appointmentTone(a.appointment_at),
      href: `/app/baustellen/${a.site_id}`,
    };
  });

  const assignmentSite = asSiteRef(myAssignment?.sites);
  if (!scheduleRows.length && assignmentSite) {
    scheduleRows.push({
      id: myAssignment?.site_id ?? 'assignment',
      time: '—',
      title: assignmentSite.name,
      place: assignmentSite.address ?? '—',
      tone: 'active',
      href: myAssignment?.site_id ? `/app/baustellen/${myAssignment.site_id}` : '/app/baustellen',
    });
  }

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
      schedule: { rows: scheduleRows },
      posts: (posts ?? []).map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        postType: post.post_type,
        publishedAt: post.published_at,
        createdAt: post.created_at,
      })),
      canManagePosts,
      leavePending: {
        rows: pendingLeaveRows,
        totalPending: totalLeavePending,
      },
      leaveMine: { rows: myLeaveRows },
      unreadMessagesCount: unreadMessagesCount ?? 0,
      showTeamTimeStats,
      showActiveWorkersLine,
      ownMinutesToday,
    },
  };
}
