import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { DocumentationOverview } from '@/components/documentation/documentation-overview';
import { DocumentationSiteFilter } from '@/components/documentation/documentation-site-filter';
import { loadDocumentationOverview } from '@/lib/documentation/load-documentation-overview';

type PageProps = {
  searchParams: Promise<{ site?: string }>;
};

export default async function RapportePage({ searchParams }: PageProps) {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.rapporte')) return <p className="muted">Keine Berechtigung.</p>;

  const { site: siteParam } = await searchParams;
  const filterSiteId = siteParam?.trim() || undefined;

  const supabase = await createClient();
  const { items, sites, selectedSiteId } = await loadDocumentationOverview(supabase, ctx, {
    siteId: filterSiteId,
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Dokumente</span>
          <h1>Dokumente</h1>
          <p>
            Pläne, PDF-Rapporte, Fotos und Lieferscheine aller Baustellen — gefiltert nach Baustelle.
            Tagesberichte erfassen Sie unter Dokumentation.
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="documentation-list-head">
          <h2>Dokumente</h2>
          <DocumentationSiteFilter sites={sites} selectedSiteId={selectedSiteId} />
        </div>
        <DocumentationOverview items={items} />
      </section>
    </>
  );
}
