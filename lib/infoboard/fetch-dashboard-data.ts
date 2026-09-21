import type { SupabaseClient } from '@supabase/supabase-js';
import { allowedWidgetIds } from '@/lib/infoboard/widgets';
import { resolveEffectiveLayout } from '@/lib/infoboard/layout';
import type {
  InfoboardWidgetData,
  PendingApprovalRow,
  ScheduleRow,
} from '@/lib/infoboard/types';
import type { PermissionKey } from '@/lib/auth/permissions';
import type { SessionContext } from '@/lib/auth/session';
import { canAccess } from '@/lib/auth/session';
import { approvalEmptyQuip } from '@/lib/time-tracking/approval-empty-quips';
import { currentHour, greetingForHour, todayWorkDate } from '@/lib/time-tracking/work-day';

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

function startOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeek(date: Date): string {
  const d = new Date(startOfWeek(date));
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
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
  const canApprove = canAccess(ctx, 'zeiten.approve');
  const canViewPosts = canAccess(ctx, 'infoboard.posts');
  const canApproveLeave = canAccess(ctx, 'urlaub.approve');
  const canViewMessages = canAccess(ctx, 'nav.nachrichten');
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
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
    { count: leavePendingCount },
    { count: unreadMessagesCount },
  ] = await Promise.all([
    supabase.from('profiles').select('dashboard_layout').eq('id', ctx.userId).single(),
    supabase
      .from('time_entries')
      .select('id')
      .eq('user_id', ctx.userId)
      .eq('approval_status', 'rejected'),
    supabase.from('time_entries').select('work_minutes, user_id, end_time').eq('work_date', today),
    supabase.from('profiles').select('id').eq('is_active', true),
    supabase.from('sites').select('id').eq('is_active', true),
    supabase
      .from('sites')
      .select('id')
      .gte('end_date', monthStart)
      .lte('end_date', today),
    supabase
      .from('sites')
      .select('id')
      .eq('is_active', true)
      .gte('start_date', weekStart)
      .lte('start_date', weekEnd),
    supabase
      .from('reports')
      .select('id, status')
      .in('status', ['draft', 'final'])
      .is('sent_at', null),
    supabase
      .from('site_appointments')
      .select('id, title, appointment_at, site_id, sites(name, address)')
      .gte('appointment_at', dayStart)
      .lte('appointment_at', dayEnd)
      .order('appointment_at'),
    supabase
      .from('daily_assignments')
      .select('site_id, sites(name, address)')
      .eq('user_id', ctx.userId)
      .eq('assignment_date', today)
      .maybeSingle(),
    canApprove
      ? supabase
          .from('time_entries')
          .select('id, work_date, work_minutes, profiles(first_name, last_name)')
          .eq('approval_status', 'pending')
          .order('submitted_at', { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
    canApprove
      ? supabase
          .from('time_entries')
          .select('id', { count: 'exact', head: true })
          .eq('approval_status', 'pending')
      : Promise.resolve({ count: 0 }),
    canViewPosts
      ? supabase
          .from('infoboard_posts')
          .select('id, title, content, post_type, published_at, created_at')
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    canApproveLeave
      ? supabase
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    canViewMessages
      ? supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', ctx.userId)
          .is('read_at', null)
      : Promise.resolve({ count: 0 }),
  ]);

  const totalMinutesToday = (todayEntries ?? []).reduce((sum, e) => sum + (e.work_minutes ?? 0), 0);
  const activeWorkers = (todayEntries ?? []).filter((e) => !e.end_time).length;
  const totalWorkers = activeProfiles?.length ?? 0;
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
      subtitle:
        activeWorkers > 0
          ? `${activeWorkers} Mitarbeitende sind heute aktiv.`
          : 'Dein Betrieb ist bereit — Starte die Zeit oben im Header.',
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
      leavePendingCount: leavePendingCount ?? 0,
      unreadMessagesCount: unreadMessagesCount ?? 0,
    },
  };
}
