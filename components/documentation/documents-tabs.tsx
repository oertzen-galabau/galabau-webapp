import Link from 'next/link';
import {
  DOCUMENTS_TABS,
  artParamForTab,
  buildDocumentsPageHref,
  type DocumentsArtFilterId,
  type DocumentsTabId,
} from '@/lib/documentation/documents-tabs';
import type { DailyLogReportType } from '@/lib/documentation/report-labels';

type Props = {
  activeTab: DocumentsTabId;
  selectedSiteId: string | null;
  siteDocArtFilter?: DocumentsArtFilterId | null;
  reportArtFilter?: DailyLogReportType | null;
};

export function DocumentsTabs({
  activeTab,
  selectedSiteId,
  siteDocArtFilter = null,
  reportArtFilter = null,
}: Props) {
  return (
    <nav className="employee-detail-tabs" aria-label="Dokumente">
      {DOCUMENTS_TABS.map((tab) => {
        const href = buildDocumentsPageHref(
          tab.id,
          selectedSiteId,
          artParamForTab(tab.id, siteDocArtFilter, reportArtFilter),
        );
        return (
          <Link
            key={tab.id}
            href={href}
            className={tab.id === activeTab ? 'active' : undefined}
            aria-current={tab.id === activeTab ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
