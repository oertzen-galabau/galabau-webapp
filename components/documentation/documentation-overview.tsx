import Link from 'next/link';
import {
  kindLabel,
  type DocumentationOverviewItem,
} from '@/lib/documentation/documentation-overview-types';
import { ReportPdfActions } from '@/components/reports/report-pdf-actions';

type Props = {
  items: DocumentationOverviewItem[];
};

function formatDisplayDate(isoDate: string) {
  if (!isoDate) return '—';
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function OverviewActions({ item }: { item: DocumentationOverviewItem }) {
  if (item.kind === 'pdf_report' && item.reportId) {
    return <ReportPdfActions reportId={item.reportId} />;
  }
  if (item.fileUrl) {
    return (
      <a href={item.fileUrl} target="_blank" rel="noreferrer" className="table-action-link">
        Öffnen
      </a>
    );
  }
  return <span className="muted">—</span>;
}

export function DocumentationOverview({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="muted">
        Keine Dokumente für die aktuelle Auswahl. Dateien werden auf der Baustelle hochgeladen;
        Tagesberichte erfassen Sie unter Dokumentation.
      </p>
    );
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table data-table--report-actions">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Baustelle</th>
            <th>Art</th>
            <th>Bezeichnung</th>
            <th className="data-table-col--actions">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{formatDisplayDate(item.sortDate)}</td>
              <td>
                <Link href={`/app/baustellen/${item.siteId}`} className="table-action-link">
                  {item.siteName || '—'}
                </Link>
              </td>
              <td>
                <span className="status-badge travel documentation-report-type-badge">
                  {kindLabel(item.kind)}
                </span>
              </td>
              <td>{item.title}</td>
              <td className="data-table-col--actions">
                <div className="inline-actions">
                  <OverviewActions item={item} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
