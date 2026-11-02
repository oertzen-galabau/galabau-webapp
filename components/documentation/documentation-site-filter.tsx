'use client';

import { useNavigationPending } from '@/components/app-shell/navigation-pending-context';
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
  const { navigate, isBusy } = useNavigationPending();
  const value = selectedSiteId ?? '';

  const options = sites.map((site) => ({ value: site.id, label: site.name }));

  function onValueChange(next: string) {
    navigate(
      buildDocumentsPageHref(
        activeTab,
        next || null,
        artParamForTab(activeTab, siteDocArtFilter, reportArtFilter),
      ),
    );
  }

  return (
    <div className={`documentation-site-filter${isBusy ? ' documentation-site-filter--pending' : ''}`}>
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
