import Link from 'next/link';
import type { ReportStatus } from '@/lib/types/database';
import { GenerateReportButton } from '@/components/reports/generate-report-button';
import { SendReportButton } from '@/components/reports/send-report-button';
import { ReportPdfActions } from '@/components/reports/report-pdf-actions';
import { DailyLogReportTypeBadge } from '@/components/documentation/daily-log-report-type-badge';
import {
  displayTitleForLog,
  isHourlyWageRapport,
  type DailyLogReportType,
  type TenantReportLabelConfig,
} from '@/lib/documentation/report-labels';

export type SiteReportEntry = {
  id: string;
  logDate: string;
  reportType: DailyLogReportType;
  customTitle: string | null;
  weather: string | null;
  notes: string | null;
  workerCount: number;
  totalHours: number;
  canEdit: boolean;
  report: {
    id: string;
    status: ReportStatus;
    pdfUrl: string | null;
    sentTo: string | null;
    sentAt: string | null;
  } | null;
};

type Props = {
  siteId: string;
  entries: SiteReportEntry[];
  canNavDocs: boolean;
  canGenerate: boolean;
  canSend: boolean;
  canCreate: boolean;
  defaultSendTo?: string | null;
  reportLabels?: TenantReportLabelConfig;
};

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function truncateNotes(notes: string | null, max = 80) {
  if (!notes?.trim()) return null;
  const trimmed = notes.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function reportStatusLabel(entry: SiteReportEntry): { label: string; badgeClass: string } {
  if (!entry.report) {
    return { label: 'Kein PDF', badgeClass: '' };
  }
  if (entry.report.sentAt) {
    return { label: 'Versendet', badgeClass: 'active' };
  }
  if (entry.report.status === 'final') {
    return { label: 'Final', badgeClass: 'active' };
  }
  return { label: 'Entwurf', badgeClass: 'travel' };
}

function buildSummary(entry: SiteReportEntry, reportLabels?: TenantReportLabelConfig) {
  const parts: string[] = [];
  const title = displayTitleForLog(entry.reportType, entry.customTitle, reportLabels);
  if (entry.customTitle?.trim()) parts.push(title);
  if (entry.weather?.trim()) parts.push(entry.weather.trim());
  if (isHourlyWageRapport(entry.reportType) && entry.workerCount > 0) {
    const hoursLabel =
      entry.totalHours > 0
        ? `${entry.workerCount} MA · ${entry.totalHours.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`
        : `${entry.workerCount} MA`;
    parts.push(hoursLabel);
  }
  const notes = truncateNotes(entry.notes);
  if (notes) parts.push(notes);
  return parts.join(' · ') || '—';
}

export function SiteReportsSection({
  siteId,
  entries,
  canNavDocs,
  canGenerate,
  canSend,
  canCreate,
  defaultSendTo,
  reportLabels,
}: Props) {
  return (
    <section className="site-detail-section">
      <div className="site-detail-section-head">
        <h2>Berichte</h2>
        {canCreate && (
          <Link href={`/app/dokumentation?site=${siteId}`} className="text-button">
            Neuer Bericht
          </Link>
        )}
      </div>

      {entries.length > 0 ? (
        <div className="data-table-wrap">
          <table className="data-table site-reports-table data-table--report-actions">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Art</th>
                <th>Inhalt</th>
                <th>PDF</th>
                <th className="data-table-col--actions">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const { label: statusLabel, badgeClass } = reportStatusLabel(entry);
                return (
                  <tr key={entry.id}>
                    <td>{formatDate(entry.logDate)}</td>
                    <td>
                      <DailyLogReportTypeBadge
                        reportType={entry.reportType}
                        customTitle={entry.customTitle}
                        reportLabels={reportLabels}
                      />
                    </td>
                    <td>{buildSummary(entry, reportLabels)}</td>
                    <td>
                      <span className={`status-badge ${badgeClass}`.trim()}>{statusLabel}</span>
                      {entry.report?.sentAt && entry.report.sentTo && (
                        <div className="site-entity-row-meta">
                          {entry.report.sentTo} ·{' '}
                          {new Date(entry.report.sentAt).toLocaleDateString('de-DE')}
                        </div>
                      )}
                    </td>
                    <td className="data-table-col--actions">
                      <div className="inline-actions site-reports-actions">
                        {entry.canEdit && (
                          <Link
                            href={`/app/dokumentation?edit=${entry.id}`}
                            className="table-action-link"
                          >
                            Bearbeiten
                          </Link>
                        )}
                        {canGenerate && !entry.report && (
                          <GenerateReportButton dailyLogId={entry.id} label="PDF erzeugen" />
                        )}
                        {entry.report?.pdfUrl && entry.report.id && (
                          <ReportPdfActions reportId={entry.report.id} />
                        )}
                        {canSend && entry.report && !entry.report.sentAt && (
                          <SendReportButton
                            reportId={entry.report.id}
                            defaultTo={defaultSendTo}
                            linkStyle
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">
          Noch keine Berichte für diese Baustelle.
          {canNavDocs && (
            <>
              {' '}
              <Link href={canCreate ? `/app/dokumentation?site=${siteId}` : '/app/dokumentation'}>
                Bericht anlegen
              </Link>
            </>
          )}
        </p>
      )}
    </section>
  );
}
