'use client';

import { useRouter } from 'next/navigation';
import { AppSelect } from '@/components/ui/app-select';
import type { SiteFilterOption } from '@/lib/documentation/documentation-overview-types';

type Props = {
  sites: SiteFilterOption[];
  selectedSiteId: string | null;
  basePath?: string;
};

export function DocumentationSiteFilter({ sites, selectedSiteId, basePath = '/app/rapporte' }: Props) {
  const router = useRouter();
  const value = selectedSiteId ?? '';

  const options = sites.map((site) => ({ value: site.id, label: site.name }));

  function onValueChange(next: string) {
    if (!next) {
      router.push(basePath);
      return;
    }
    router.push(`${basePath}?site=${encodeURIComponent(next)}`);
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
