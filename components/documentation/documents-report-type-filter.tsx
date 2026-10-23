import Link from 'next/link';
import { buildDocumentsPageHref } from '@/lib/documentation/documents-tabs';
import {
  DAILY_LOG_REPORT_TYPES,
  shortLabelForReportType,
  type DailyLogReportType,
  type TenantReportLabelConfig,
} from '@/lib/documentation/report-labels';

type Props = {
  activeReportArt: DailyLogReportType | null;
  selectedSiteId: string | null;
  reportLabels: TenantReportLabelConfig;
};

export function DocumentsReportTypeFilter({
  activeReportArt,
  selectedSiteId,
  reportLabels,
}: Props) {
  const entries: { id: DailyLogReportType | null; label: string }[] = [
    { id: null, label: 'Alle' },
    ...DAILY_LOG_REPORT_TYPES.map((type) => ({
      id: type,
      label: shortLabelForReportType(type, reportLabels),
    })),
  ];

  return (
    <div className="documents-art-filter-wrap">
      <span className="documents-art-filter-label" id="documents-report-type-filter-label">
        Art
      </span>
      <nav
        className="documents-art-filter"
        aria-labelledby="documents-report-type-filter-label"
      >
        {entries.map((entry) => {
          const href = buildDocumentsPageHref('rapporte', selectedSiteId, entry.id);
          const isActive =
            entry.id === activeReportArt || (entry.id === null && !activeReportArt);
          return (
            <Link
              key={entry.id ?? 'all'}
              href={href}
              className={`documents-art-filter-segment${isActive ? ' documents-art-filter-segment--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {entry.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
