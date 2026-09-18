import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { GenerateReportButton } from '@/components/reports/generate-report-button';
import { SendReportButton } from '@/components/reports/send-report-button';
import { getSignedFileUrls } from '@/lib/supabase/storage';

export default async function RapportePage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.rapporte')) return <p className="muted">Keine Berechtigung.</p>;

  const supabase = await createClient();

  const { data: reports } = await supabase
    .from('reports')
    .select('*, sites(name)')
    .order('report_date', { ascending: false });

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('id, log_date, site_id, sites(name)')
    .order('log_date', { ascending: false })
    .limit(30);

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
          {(logs ?? []).map((log) => (
            <GenerateReportButton
              key={log.id}
              dailyLogId={log.id}
              label={`${log.log_date} · ${(log.sites as { name: string }[] | null)?.[0]?.name ?? ''}`}
            />
          ))}
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
