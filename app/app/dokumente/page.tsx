import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { DocumentationOverview } from '@/components/documentation/documentation-overview';
import { DocumentationSiteFilter } from '@/components/documentation/documentation-site-filter';
import { DocumentsPhotoGrid } from '@/components/documentation/documents-photo-grid';
import { DocumentsArtFilter } from '@/components/documentation/documents-art-filter';
import { DocumentsReportTypeFilter } from '@/components/documentation/documents-report-type-filter';
import { DocumentsTabs } from '@/components/documentation/documents-tabs';
import {
  emptyStateMessage,
  parseDocumentsArtFilter,
  parseDocumentsTab,
  parseReportArtFilter,
  tabPanelTitle,
} from '@/lib/documentation/documents-tabs';
import { tenantReportLabelsFromTenant } from '@/lib/documentation/report-labels';
import { loadDocumentationOverview } from '@/lib/documentation/load-documentation-overview';

type PageProps = {
  searchParams: Promise<{ site?: string; tab?: string; art?: string }>;
};

export default async function DokumentePage({ searchParams }: PageProps) {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.rapporte')) return <p className="muted">Keine Berechtigung.</p>;

  const { site: siteParam, tab: tabParam, art: artParam } = await searchParams;
  const filterSiteId = siteParam?.trim() || undefined;
  const activeTab = parseDocumentsTab(tabParam);
  const siteDocArtFilter = parseDocumentsArtFilter(artParam, activeTab);
  const reportArtFilter = parseReportArtFilter(artParam, activeTab);
  const reportLabels = tenantReportLabelsFromTenant(ctx.tenant);

  const supabase = await createClient();
  const { items, sites, selectedSiteId } = await loadDocumentationOverview(supabase, ctx, {
    siteId: filterSiteId,
    tab: activeTab,
    art: artParam,
  });

  const panelTitle = tabPanelTitle(activeTab);
  const emptyMessage = emptyStateMessage(activeTab);

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Dokumente</h1>
          <p>
            Pläne und Baustellen-Dateien, PDF-Rapporte, Fotos und Lieferscheine — gefiltert nach
            Baustelle. Tagesberichte erfassen Sie unter Dokumentation.
          </p>
        </div>
      </div>

      <DocumentsTabs
        activeTab={activeTab}
        selectedSiteId={selectedSiteId}
        siteDocArtFilter={siteDocArtFilter}
        reportArtFilter={reportArtFilter}
      />

      <section className="panel">
        <div className="documentation-list-head">
          <h2>{panelTitle}</h2>
          <div className="documentation-list-head-actions">
            {activeTab === 'dokumente' ? (
              <DocumentsArtFilter activeArt={siteDocArtFilter} selectedSiteId={selectedSiteId} />
            ) : null}
            {activeTab === 'rapporte' ? (
              <DocumentsReportTypeFilter
                activeReportArt={reportArtFilter}
                selectedSiteId={selectedSiteId}
                reportLabels={reportLabels}
              />
            ) : null}
            <DocumentationSiteFilter
              sites={sites}
              selectedSiteId={selectedSiteId}
              activeTab={activeTab}
              siteDocArtFilter={siteDocArtFilter}
              reportArtFilter={reportArtFilter}
            />
          </div>
        </div>
        {activeTab === 'fotos' ? (
          <DocumentsPhotoGrid items={items} emptyMessage={emptyMessage} />
        ) : (
          <DocumentationOverview
            items={items}
            emptyMessage={emptyMessage}
            showKindColumn={activeTab === 'dokumente' || activeTab === 'rapporte'}
          />
        )}
      </section>
    </>
  );
}
