import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { GenerateReportButton } from '@/components/reports/generate-report-button';
import { SendReportButton } from '@/components/reports/send-report-button';
import { getSignedFileUrls } from '@/lib/supabase/storage';
import {
  displayTitleForLog,
  parseDailyLogReportType,
  shortLabelForReportType,
} from '@/lib/documentation/report-labels';
import { applyAccessibleSiteIdFilter, resolveAccessibleSiteIds } from '@/lib/sites/access';

export default async function RapportePage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.rapporte')) return <p className="muted">Keine Berechtigung.</p>;

  const supabase = await createClient();
  const accessibleSiteIds = await resolveAccessibleSiteIds(supabase, ctx);

  let reportsQuery = supabase
    .from('reports')
    .select('*, sites(name)')
    .order('report_date', { ascending: false });
  reportsQuery = applyAccessibleSiteIdFilter(reportsQuery, 'site_id', accessibleSiteIds);
  const { data: reports } = await reportsQuery;

  let logsQuery = supabase
    .from('daily_logs')
    .select('id, log_date, site_id, report_type, custom_title, sites(name)')
    .order('log_date', { ascending: false })
    .limit(30);
  logsQuery = applyAccessibleSiteIdFilter(logsQuery, 'site_id', accessibleSiteIds);
  const { data: logs } = await logsQuery;

  const pdfPaths = (reports ?? []).map((r) => r.pdf_url).filter(Boolean) as string[];
  const signedUrls = await getSignedFileUrls('reports', pdfPaths);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Rapporte</span>
          <h1>PDF-Rapporte</h1>
          <p>Automatische Erstellung aus Tagesdaten, Archivierung und Versand.</p>
        </div>
      </div>

      <section className="panel">
        <h2>Rapport aus Tagesdaten erzeugen</h2>
        <div className="form-stack">
          {(logs ?? []).map((log) => {
            const siteRaw = log.sites as { name: string } | { name: string }[] | null;
            const siteName = Array.isArray(siteRaw) ? siteRaw[0]?.name ?? '' : siteRaw?.name ?? '';
            const reportType = parseDailyLogReportType(log.report_type as string);
            const title = displayTitleForLog(reportType, log.custom_title as string | null);
            const typeLabel = shortLabelForReportType(reportType);
            return (
              <GenerateReportButton
                key={log.id}
                dailyLogId={log.id}
                label={`${log.log_date} · ${siteName} · ${typeLabel}${log.custom_title?.trim() ? ` · ${title}` : ''}`}
              />
            );
          })}
          {!logs?.length && <p className="muted">Keine Tagesdaten vorhanden.</p>}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Archiv</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Datum</th><th>Baustelle</th><th>Status</th><th>PDF</th><th className="data-table-col--optional">Versand</th></tr></thead>
            <tbody>
              {(reports ?? []).map((report) => {
                const url = report.pdf_url ? signedUrls.get(report.pdf_url) : null;
                return (
                  <tr key={report.id}>
                    <td>{report.report_date}</td>
                    <td>{report.sites?.name}</td>
                    <td>{report.status}</td>
                    <td>{url ? <a href={url} target="_blank" rel="noreferrer">Download</a> : '—'}</td>
                    <td className="data-table-col--optional">
                    {report.sent_at
                      ? `${report.sent_to} · ${new Date(report.sent_at).toLocaleDateString('de-DE')}`
                      : <SendReportButton reportId={report.id} defaultTo={ctx.profile.email} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
