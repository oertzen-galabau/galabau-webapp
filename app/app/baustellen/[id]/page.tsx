import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireTenantMember } from '@/lib/auth/session';
import { canAccess } from '@/lib/auth/session';
import { getSignedFileUrls } from '@/lib/supabase/storage';
import { SiteAppearanceSection } from '@/components/sites/site-appearance-section';
import { SiteMetaForm } from '@/components/sites/site-meta-form';
import { SiteContactsSection } from '@/components/sites/site-contacts-section';
import { SiteTeamSection, type SiteTeamMemberRow } from '@/components/sites/site-team-section';
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
import { userCanAccessSite } from '@/lib/sites/access';
import { formatSiteAddress } from '@/lib/sites/format-address';
import {
  loadForemanOptions,
  loadSiteManagerOptions,
  loadTenantEmployeeTeamOptions,
  withProfileOption,
} from '@/lib/sites/foremen-options';
import type { TimeBlockType } from '@/lib/types/database';
import { parseDailyLogReportType, tenantReportLabelsFromTenant } from '@/lib/documentation/report-labels';
import { resolveOwnedDailyLogIds, userCanEditDailyLog, canViewAllReports } from '@/lib/documentation/report-access';

async function countRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  tenantId: string,
  siteId: string,
) {
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('site_id', siteId);
  return count ?? 0;
}

export default async function BaustelleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.baustellen')) return <p className="muted">Keine Berechtigung.</p>;
  const reportLabels = tenantReportLabelsFromTenant(ctx.tenant);

  const supabase = await createClient();
  const canAccessSite = await userCanAccessSite(supabase, ctx, id);
  if (!canAccessSite) notFound();

  const canManageSites = canAccess(ctx, 'sites.manage');
  const canManageTeam = canAccess(ctx, 'sites.assign_team');
  const tenantId = ctx.tenant!.id;
  const canViewAllTime = canAccess(ctx, 'zeiten.view_all');
  const canManageDocs = canAccess(ctx, 'documentation.manage');

  const ownedLogIdsOnSite = await resolveOwnedDailyLogIds(supabase, ctx, tenantId, { siteId: id });

  let dailyLogsQuery = supabase
    .from('daily_logs')
    .select('id, log_date, weather, notes, report_type, custom_title, created_by')
    .eq('site_id', id)
    .order('log_date', { ascending: false });
  if (!canViewAllReports(ctx)) {
    dailyLogsQuery = dailyLogsQuery.eq('created_by', ctx.userId);
  }

  let siteReportsQuery = supabase
    .from('reports')
    .select('id, daily_log_id, report_date, status, pdf_url, sent_to, sent_at')
    .eq('site_id', id)
    .order('report_date', { ascending: false });
  if (ownedLogIdsOnSite !== null) {
    siteReportsQuery = siteReportsQuery.in('daily_log_id', ownedLogIdsOnSite);
  }
  const siteReportsPromise = siteReportsQuery;

  const [
    { data: site },
    { data: contacts },
    { data: suppliers },
    { data: documents },
    { data: appointments },
    { data: dailyLogs },
    dailyLogCount,
    reportCount,
    timeEntryCount,
    assignmentCount,
    badWeatherCount,
    segmentCount,
    foremanOptions,
    siteManagerOptions,
    { data: teamRows },
    { data: masterSuppliers },
  ] = await Promise.all([
    supabase.from('sites').select('*').eq('id', id).eq('tenant_id', tenantId).single(),
    supabase.from('site_contacts').select('*').eq('site_id', id).order('name'),
    supabase.from('site_suppliers').select('*').eq('site_id', id).order('name'),
    supabase.from('site_documents').select('*').eq('site_id', id).order('created_at', { ascending: false }),
    supabase.from('site_appointments').select('*').eq('site_id', id).order('appointment_at'),
    dailyLogsQuery,
    countRows(supabase, 'daily_logs', tenantId, id),
    countRows(supabase, 'reports', tenantId, id),
    countRows(supabase, 'time_entries', tenantId, id),
    countRows(supabase, 'daily_assignments', tenantId, id),
    countRows(supabase, 'bad_weather_days', tenantId, id),
    countRows(supabase, 'time_entry_segments', tenantId, id),
    canManageTeam ? loadForemanOptions(supabase, ctx.tenant!.id) : Promise.resolve([]),
    canManageTeam ? loadSiteManagerOptions(supabase, ctx.tenant!.id) : Promise.resolve([]),
    supabase
      .from('site_team_members')
      .select('id, user_id, profiles(first_name, last_name, tenant_roles(name, slug))')
      .eq('site_id', id)
      .order('created_at'),
    supabase
      .from('tenant_business_partners')
      .select('id, name, contact_person')
      .eq('tenant_id', ctx.tenant!.id)
      .eq('kind', 'supplier')
      .eq('is_active', true)
      .order('name'),
  ]);

  const { data: siteReports } = await siteReportsPromise;

  const teamMembers: SiteTeamMemberRow[] = (teamRows ?? []).map((row) => {
    const profileRaw = row.profiles;
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
    const roleRaw = profile?.tenant_roles;
    const role = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw;
    const first = profile?.first_name ?? '';
    const last = profile?.last_name ?? '';
    return {
      id: row.id,
      userId: row.user_id,
      displayName: `${first} ${last}`.trim() || '—',
      roleLabel: (role as { name?: string } | null)?.name ?? 'Mitarbeiter',
    };
  });

  const assignedUserIds = teamMembers.map((member) => member.userId);
  const employeeTeamOptions = canManageTeam
    ? await loadTenantEmployeeTeamOptions(supabase, ctx.tenant!.id, assignedUserIds)
    : [];

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
    const logCreatedBy = log.created_by as string | null;
    return {
      id: log.id,
      logDate: log.log_date,
      reportType: parseDailyLogReportType(log.report_type as string),
      customTitle: log.custom_title as string | null,
      weather: log.weather,
      notes: log.notes,
      workerCount: stats?.count ?? 0,
      totalHours: stats?.totalHours ?? 0,
      canEdit:
        canManageDocs &&
        Boolean(site?.is_active) &&
        userCanEditDailyLog(ctx, { created_by: logCreatedBy }),
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

  const approvedSiteSegments = canViewAllTime
    ? (
        await supabase
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
          .order('created_at', { ascending: false })
      ).data ?? []
    : [];

  const approvedEntriesMap = new Map<string, SiteApprovedTimeEntry>();
  for (const segment of approvedSiteSegments) {
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

  const [foremanOptionsForLeads, siteManagerOptionsForLeads] = canManageTeam
    ? await Promise.all([
        withProfileOption(supabase, tenantId, site.responsible_user_id, foremanOptions),
        withProfileOption(supabase, tenantId, site.site_manager_user_id, siteManagerOptions),
      ])
    : [foremanOptions, siteManagerOptions];

  const canManage = canAccess(ctx, 'sites.manage');
  const canEditAppearance = canAccess(ctx, 'sites.appearance') && site.is_active;
  const canEdit = canManage && site.is_active;
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
  const signedUrls = await getSignedFileUrls(tenantId, 'site-documents', docPaths);

  const plans = (documents ?? []).filter((d) => d.category === 'plan');
  const lv = (documents ?? []).filter((d) => d.category === 'leistungsverzeichnis');
  const sonstige = (documents ?? []).filter((d) => !d.category || d.category === 'sonstiges');

  return (
    <>
      <div className="page-heading order-heading">
        <div>
          <span className={`status-badge ${site.is_active ? 'active' : 'travel'}`}>
            {site.is_active ? 'Aktiv' : 'Abgeschlossen'}
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
          <SiteTeamSection
            siteId={id}
            siteManagerUserId={site.site_manager_user_id}
            foremanUserId={site.responsible_user_id}
            siteManagerOptions={siteManagerOptionsForLeads}
            foremanOptions={foremanOptionsForLeads}
            members={teamMembers}
            employeeOptions={employeeTeamOptions}
            canEdit={canManageTeam && site.is_active}
          />
          <SiteContactsSection siteId={id} contacts={contacts ?? []} canEdit={canEdit} />
          <SiteSuppliersSection
            siteId={id}
            suppliers={suppliers ?? []}
            masterSuppliers={masterSuppliers ?? []}
            canEdit={canEdit}
            canManagePartners={canAccess(ctx, 'partners.manage')}
          />
          <SiteReportsSection
            siteId={id}
            entries={reportEntries}
            canNavDocs={canNavDocs}
            canGenerate={canGenerate}
            canSend={canSend}
            canCreate={canCreateReport}
            defaultSendTo={ctx.profile.email}
            reportLabels={reportLabels}
          />
          {canViewAllTime && <SiteTimeEntriesSection entries={approvedSiteEntries} />}
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

          {canEditAppearance ? (
            <SiteAppearanceSection
              site={site}
              documents={documents ?? []}
              signedUrls={Object.fromEntries(signedUrls)}
            />
          ) : null}
        </aside>
      </div>
    </>
  );
}
