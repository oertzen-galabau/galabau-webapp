import Link from 'next/link';
import {
  ArrowRight, BriefcaseBusiness, CheckCircle2, ChevronRight, Clock3, FileText,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { approvalEmptyQuip } from '@/lib/time-tracking/approval-empty-quips';
import { currentHour, greetingForHour, todayWorkDate } from '@/lib/time-tracking/work-day';
import { formatMinutes } from '@/lib/utils/time';

type ProfileRef = { first_name: string; last_name: string };

function asProfile(value: unknown): ProfileRef | null {
  if (!value || Array.isArray(value)) return null;
  const profile = value as ProfileRef;
  return profile.first_name ? profile : null;
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
  const date = new Date(iso);
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(date);
}

type SiteRef = { name: string; address: string | null };

function asSiteRef(value: unknown): SiteRef | null {
  if (!value || Array.isArray(value)) return null;
  const site = value as SiteRef;
  return site.name ? site : null;
}

function appointmentTone(iso: string): 'active' | 'travel' | 'planned' {
  const now = Date.now();
  const time = new Date(iso).getTime();
  const diffHours = (time - now) / (1000 * 60 * 60);
  if (diffHours <= 0 && diffHours > -4) return 'active';
  if (diffHours > 0 && diffHours <= 2) return 'travel';
  return 'planned';
}

export default async function DashboardPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.infoboard')) return <p className="muted">Keine Berechtigung.</p>;

  const supabase = await createClient();
  const today = todayWorkDate();
  const canApprove = canAccess(ctx, 'zeiten.approve');
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const dayStart = `${today}T00:00:00`;
  const dayEnd = `${today}T23:59:59`;

  const [
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
  ] = await Promise.all([
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
  ]);

  const totalMinutesToday = (todayEntries ?? []).reduce((sum, e) => sum + (e.work_minutes ?? 0), 0);
  const activeWorkers = (todayEntries ?? []).filter((e) => !e.end_time).length;
  const totalWorkers = activeProfiles?.length ?? 0;
  const pendingReports = (openReports ?? []).filter((r) => r.status === 'draft').length;

  const greeting = greetingForHour(currentHour());
  const firstName = ctx.profile.first_name || 'Team';
  const rejectedCount = rejectedTimeEntries?.length ?? 0;
  const totalPending = pendingCount ?? 0;
  const emptyApprovalQuip = approvalEmptyQuip(today);

  type ScheduleRow = {
    id: string;
    time: string;
    title: string;
    place: string;
    tone: 'active' | 'travel' | 'planned';
    href: string;
  };

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

  const dateLabel = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(now);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Büro · Live-Status</span>
          <h1>{greeting}, {firstName}.</h1>
          <p>
            {activeWorkers > 0
              ? `${activeWorkers} Mitarbeitende sind heute aktiv.`
              : 'Dein Betrieb ist bereit — Starte die Zeit oben im Header.'}
          </p>
        </div>
      </div>

      {rejectedCount > 0 && (
        <div className="callout callout-danger" style={{ marginBottom: 20 }}>
          <strong>
            {rejectedCount === 1
              ? '1 Zeiteintrag wurde abgelehnt'
              : `${rejectedCount} Zeiteinträge wurden abgelehnt`}
          </strong>
          <p>Bitte korrigiere deine Zeiten und reiche sie erneut ein.</p>
          <Link href="/app/zeiten#korrektur" className="text-button">
            Jetzt korrigieren
          </Link>
        </div>
      )}

      {canApprove && (
        <section className="panel schedule-panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <div>
              <span className="eyebrow">Freigabe</span>
              <h2>Zeiten zur Freigabe</h2>
            </div>
            <Link href="/app/zeiten#freigabe" className="text-button">
              Zur Freigabe-Übersicht <ArrowRight size={16} />
            </Link>
          </div>
          <div className="job-list">
            {(pendingPreview ?? []).map((entry) => {
              const profile = asProfile(entry.profiles);
              const name = profile ? `${profile.first_name} ${profile.last_name}` : 'Unbekannt';
              return (
                <Link className="job-row" key={entry.id} href="/app/zeiten#freigabe">
                  <time>{entry.work_date}</time>
                  <span className="job-marker travel" />
                  <span className="job-copy">
                    <strong>{name}</strong>
                    <small>{formatMinutes(entry.work_minutes)} Std.</small>
                  </span>
                  <ChevronRight size={18} />
                </Link>
              );
            })}
            {!totalPending && (
              <p className="muted">{emptyApprovalQuip}</p>
            )}
          </div>
          {totalPending > 5 && (
            <p className="approval-preview-count">
              + {totalPending - 5} weitere in der Freigabe-Übersicht
            </p>
          )}
        </section>
      )}

      <div className="metric-grid">
        <article className="metric-card metric-feature">
          <div className="metric-icon"><Clock3 size={20} /></div>
          <span>Heute erfasst</span>
          <strong>{formatMinutes(totalMinutesToday)} <small>Std.</small></strong>
          <p><i /> {activeWorkers} von {totalWorkers} Mitarbeitenden aktiv</p>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><BriefcaseBusiness size={20} /></div>
          <span>Offene Aufträge</span>
          <strong>{activeSites?.length ?? 0}</strong>
          <p><b>{startingSites?.length ?? 0}</b> starten diese Woche</p>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><CheckCircle2 size={20} /></div>
          <span>Erledigt im Monat</span>
          <strong>{completedSites?.length ?? 0}</strong>
          <p>Abgeschlossene Baustellen</p>
        </article>
        <article className="metric-card">
          <div className="metric-icon"><FileText size={20} /></div>
          <span>Offene Nachweise</span>
          <strong>{openReports?.length ?? 0}</strong>
          <p>{pendingReports} benötigen Freigabe</p>
        </article>
      </div>

      <div className="dashboard-columns">
        <section className="panel schedule-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">{dateLabel}</span>
              <h2>Heutige Einsätze</h2>
            </div>
            <Link href="/app/baustellen" className="text-button">
              Alle Aufträge <ArrowRight size={16} />
            </Link>
          </div>
          <div className="job-list">
            {scheduleRows.map((job) => (
              <Link className="job-row" key={job.id} href={job.href}>
                <time>{job.time}</time>
                <span className={`job-marker ${job.tone}`} />
                <span className="job-copy">
                  <strong>{job.title}</strong>
                  <small>{job.place}</small>
                </span>
                <ChevronRight size={18} />
              </Link>
            ))}
            {!scheduleRows.length && (
              <p className="muted">Keine Einsätze für heute geplant.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
