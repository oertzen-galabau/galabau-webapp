import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireTenantMember } from '@/lib/auth/session';
import { canAccess } from '@/lib/auth/session';
import { getSignedFileUrls } from '@/lib/supabase/storage';
import { SiteMetaForm } from '@/components/sites/site-meta-form';
import { SiteContactsSection } from '@/components/sites/site-contacts-section';
import { SiteSuppliersSection } from '@/components/sites/site-suppliers-section';
import { SiteAppointmentsSection } from '@/components/sites/site-appointments-section';
import { SiteDocumentsSection } from '@/components/sites/site-documents-section';
import { SiteWeatherSection } from '@/components/sites/site-weather-section';
import { SiteDeleteButton } from '@/components/sites/site-delete-button';
import { SiteReportsSection, type SiteReportEntry } from '@/components/sites/site-reports-section';
import {
  SiteTimeEntriesSection,
  type SiteApprovedTimeEntry,
} from '@/components/sites/site-time-entries-section';
import { formatSiteAddress } from '@/lib/sites/format-address';
import type { TimeBlockType } from '@/lib/types/database';

async function countRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  siteId: string,
) {
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('site_id', siteId);
  return count ?? 0;
}

export default async function BaustelleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.baustellen')) return <p className="muted">Keine Berechtigung.</p>;

  const supabase = await createClient();

  const [
    { data: site },
    { data: contacts },
    { data: suppliers },
    { data: documents },
    { data: appointments },
    { data: dailyLogs },
    { data: siteReports },
    dailyLogCount,
    reportCount,
    timeEntryCount,
    assignmentCount,
    badWeatherCount,
    segmentCount,
  ] = await Promise.all([
    supabase.from('sites').select('*').eq('id', id).single(),
    supabase.from('site_contacts').select('*').eq('site_id', id).order('name'),
    supabase.from('site_suppliers').select('*').eq('site_id', id).order('name'),
    supabase.from('site_documents').select('*').eq('site_id', id).order('created_at', { ascending: false }),
    supabase.from('site_appointments').select('*').eq('site_id', id).order('appointment_at'),
    supabase
      .from('daily_logs')
      .select('id, log_date, weather, notes')
      .eq('site_id', id)
      .order('log_date', { ascending: false }),
    supabase
      .from('reports')
      .select('id, daily_log_id, report_date, status, pdf_url, sent_to, sent_at')
      .eq('site_id', id)
      .order('report_date', { ascending: false }),
    countRows(supabase, 'daily_logs', id),
    countRows(supabase, 'reports', id),
    countRows(supabase, 'time_entries', id),
    countRows(supabase, 'daily_assignments', id),
    countRows(supabase, 'bad_weather_days', id),
    countRows(supabase, 'time_entry_segments', id),
  ]);

  const dailyLogIds = (dailyLogs ?? []).map((log) => log.id);
  const { data: workerHours } = dailyLogIds.length
    ? await supabase
        .from('daily_log_worker_hours')
        .select('daily_log_id, hours')
        .in('daily_log_id', dailyLogIds)
    : { data: [] };

  const workerStatsByLog = new Map<string, { count: number; totalHours: number }>();
  for (const row of workerHours ?? []) {
    const current = workerStatsByLog.get(row.daily_log_id) ?? { count: 0, totalHours: 0 };
    current.count += 1;
    current.totalHours += Number(row.hours) || 0;
    workerStatsByLog.set(row.daily_log_id, current);
  }

  const reportByDailyLogId = new Map(
    (siteReports ?? [])
      .filter((report) => report.daily_log_id)
      .map((report) => [report.daily_log_id as string, report]),
  );

  const reportEntries: SiteReportEntry[] = (dailyLogs ?? []).map((log) => {
    const stats = workerStatsByLog.get(log.id);
    const report = reportByDailyLogId.get(log.id) ?? null;
    return {
      id: log.id,
      logDate: log.log_date,
      weather: log.weather,
      notes: log.notes,
      workerCount: stats?.count ?? 0,
      totalHours: stats?.totalHours ?? 0,
      report: report
        ? {
            id: report.id,
            status: report.status,
            pdfUrl: report.pdf_url,
            sentTo: report.sent_to,
            sentAt: report.sent_at,
          }
        : null,
    };
  });

  const pdfPaths = (siteReports ?? []).map((r) => r.pdf_url).filter(Boolean) as string[];
  const signedPdfUrls = await getSignedFileUrls('reports', pdfPaths);

  const { data: approvedSiteSegments } = await supabase
    .from('time_entry_segments')
    .select(`
      start_time,
      end_time,
      block_type,
      time_entries!inner(
        id,
        work_date,
        approval_status,
        profiles(first_name, last_name)
      )
    `)
    .eq('site_id', id)
    .eq('block_type', 'site_work')
    .eq('time_entries.approval_status', 'approved')
    .not('start_time', 'is', null)
    .not('end_time', 'is', null)
    .order('created_at', { ascending: false });

  const approvedEntriesMap = new Map<string, SiteApprovedTimeEntry>();
  for (const segment of approvedSiteSegments ?? []) {
    const entryRaw = segment.time_entries;
    const entry = (Array.isArray(entryRaw) ? entryRaw[0] : entryRaw) as {
      id: string;
      work_date: string;
      profiles: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
    } | null;
    if (!entry || !segment.start_time || !segment.end_time) continue;

    const profileRaw = entry.profiles;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] ?? null : profileRaw;
    const existing: SiteApprovedTimeEntry = approvedEntriesMap.get(entry.id) ?? {
      id: entry.id,
      work_date: entry.work_date,
      start_time: segment.start_time,
      end_time: segment.end_time,
      profiles: profile,
      blocks: [],
    };

    existing.blocks.push({
      block_type: (segment.block_type ?? 'site_work') as TimeBlockType,
      start_time: segment.start_time,
      end_time: segment.end_time,
    });
    approvedEntriesMap.set(entry.id, existing);
  }

  const approvedSiteEntries = [...approvedEntriesMap.values()].sort((a, b) =>
    b.work_date.localeCompare(a.work_date),
  );

  if (!site) notFound();

  const canManage = canAccess(ctx, 'sites.manage');
  const canEdit = canManage && site.is_active;
  const canManageDocs = canAccess(ctx, 'documentation.manage');
  const canNavDocs = canAccess(ctx, 'nav.dokumentation');
  const canGenerate = canAccess(ctx, 'reports.generate');
  const canSend = canAccess(ctx, 'reports.send');
  const canCreateReport = canManageDocs && site.is_active;

  const hasDocumentation =
    (documents?.length ?? 0) > 0 || dailyLogCount > 0 || reportCount > 0;
  const hasOperationalData =
    timeEntryCount > 0 || assignmentCount > 0 || badWeatherCount > 0 || segmentCount > 0;
  const removeMode = hasDocumentation || hasOperationalData ? 'archive' : 'delete';

  const docPaths = (documents ?? []).map((d) => d.file_url).filter(Boolean) as string[];
  const signedUrls = await getSignedFileUrls('site-documents', docPaths);

  const plans = (documents ?? []).filter((d) => d.category === 'plan');
  const lv = (documents ?? []).filter((d) => d.category === 'leistungsverzeichnis');
  const sonstige = (documents ?? []).filter((d) => !d.category || d.category === 'sonstiges');

  return (
    <>
      <div className="page-heading order-heading">
        <div>
          <span className={`status-badge ${site.is_active ? 'active' : 'travel'}`}>
            {site.is_active ? 'Aktiv' : 'Archiviert'}
          </span>
          <h1>{site.name}</h1>
          <p>{formatSiteAddress(site) ?? '—'} · Kunde: {site.client_name ?? '—'}</p>
        </div>
        {canManage && site.is_active && (
          <SiteDeleteButton siteId={id} siteName={site.name} mode={removeMode} />
        )}
      </div>

      <div className="order-layout">
        <section className="panel order-main">
          <SiteMetaForm site={site} canEdit={canEdit} />
          <SiteContactsSection siteId={id} contacts={contacts ?? []} canEdit={canEdit} />
          <SiteSuppliersSection siteId={id} suppliers={suppliers ?? []} canEdit={canEdit} />
          <SiteReportsSection
            siteId={id}
            entries={reportEntries}
            signedPdfUrls={signedPdfUrls}
            canManageDocs={canManageDocs && site.is_active}
            canNavDocs={canNavDocs}
            canGenerate={canGenerate}
            canSend={canSend}
            canCreate={canCreateReport}
            defaultSendTo={ctx.profile.email}
          />
          <SiteTimeEntriesSection entries={approvedSiteEntries} />
        </section>

        <aside className="order-side">
          <section className="panel">
            <SiteWeatherSection site={site} />
          </section>

          <section className="panel">
            <SiteAppointmentsSection siteId={id} appointments={appointments ?? []} canEdit={canEdit} />
          </section>

          <section className="panel">
            <SiteDocumentsSection
              siteId={id}
              plans={plans}
              lv={lv}
              other={sonstige}
              signedUrls={signedUrls}
              canEdit={canEdit}
            />
          </section>
        </aside>
      </div>
    </>
  );
}
