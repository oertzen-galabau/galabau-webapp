'use client';

import { useRouter } from 'next/navigation';
import { AppSelect } from '@/components/ui/app-select';
import {
  artParamForTab,
  buildDocumentsPageHref,
  type DocumentsArtFilterId,
  type DocumentsTabId,
} from '@/lib/documentation/documents-tabs';
import type { DailyLogReportType } from '@/lib/documentation/report-labels';
import type { SiteFilterOption } from '@/lib/documentation/documentation-overview-types';

type Props = {
  sites: SiteFilterOption[];
  selectedSiteId: string | null;
  activeTab?: DocumentsTabId;
  siteDocArtFilter?: DocumentsArtFilterId | null;
  reportArtFilter?: DailyLogReportType | null;
};

export function DocumentationSiteFilter({
  sites,
  selectedSiteId,
  activeTab = 'dokumente',
  siteDocArtFilter = null,
  reportArtFilter = null,
}: Props) {
  const router = useRouter();
  const value = selectedSiteId ?? '';

  const options = sites.map((site) => ({ value: site.id, label: site.name }));

  function onValueChange(next: string) {
    router.push(
      buildDocumentsPageHref(
        activeTab,
        next || null,
        artParamForTab(activeTab, siteDocArtFilter, reportArtFilter),
      ),
    );
  }

  return (
    <div className="documentation-site-filter">
      <span className="documentation-site-filter-label">Baustelle</span>
      <AppSelect
        aria-label="Baustelle filtern"
        value={value}
        onValueChange={onValueChange}
        options={options}
        allowEmpty
        placeholder="Alle Baustellen"
        className="documentation-site-filter-select"
      />
    </div>
  );
}
