import Link from 'next/link';
import {
  DOCUMENTS_ART_FILTERS,
  buildDocumentsPageHref,
  type DocumentsArtFilterId,
} from '@/lib/documentation/documents-tabs';

type Props = {
  activeArt: DocumentsArtFilterId | null;
  selectedSiteId: string | null;
};

export function DocumentsArtFilter({ activeArt, selectedSiteId }: Props) {
  return (
    <div className="documents-art-filter-wrap">
      <span className="documents-art-filter-label" id="documents-art-filter-label">
        Art
      </span>
      <nav
        className="documents-art-filter"
        aria-labelledby="documents-art-filter-label"
      >
        {DOCUMENTS_ART_FILTERS.map((entry) => {
          const href = buildDocumentsPageHref('dokumente', selectedSiteId, entry.id);
          const isActive = entry.id === activeArt || (entry.id === null && !activeArt);
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
