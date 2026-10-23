import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { SiteCreateDialog } from '@/components/sites/site-create-dialog';
import { SitesArchivedToggle } from '@/components/sites/sites-archived-toggle';
import { SitesListClient } from '@/components/sites/sites-list-client';
import { canViewAllSites, resolveAccessibleSiteIds } from '@/lib/sites/access';
import { loadSiteListCoverContext } from '@/lib/sites/load-list-covers';
import { loadForemanOptions } from '@/lib/sites/foremen-options';
import type { Site } from '@/lib/types/database';

type PageProps = {
  searchParams: Promise<{ archived?: string }>;
};

export default async function BaustellenPage({ searchParams }: PageProps) {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.baustellen')) return <p className="muted">Keine Berechtigung.</p>;

  const { archived: archivedParam } = await searchParams;
  const showArchived = archivedParam === '1';

  const supabase = await createClient();
  const accessibleIds = await resolveAccessibleSiteIds(supabase, ctx);

  let activeQuery = supabase
    .from('sites')
    .select('*')
    .eq('tenant_id', ctx.tenant!.id)
    .eq('is_active', true)
    .order('list_sort_order', { ascending: true })
    .order('name');
  if (accessibleIds !== null) {
    activeQuery = accessibleIds.length
      ? activeQuery.in('id', accessibleIds)
      : activeQuery.in('id', ['00000000-0000-0000-0000-000000000000']);
  }
  let archivedQuery = showArchived
    ? supabase
        .from('sites')
        .select('*')
        .eq('tenant_id', ctx.tenant!.id)
        .eq('is_active', false)
        .order('name')
    : null;
  if (archivedQuery && accessibleIds !== null) {
    archivedQuery = accessibleIds.length
      ? archivedQuery.in('id', accessibleIds)
      : archivedQuery.in('id', ['00000000-0000-0000-0000-000000000000']);
  }
  const archivedPromise = archivedQuery
    ? archivedQuery
    : Promise.resolve({ data: [] as Site[] });

  const canManage = canAccess(ctx, 'sites.manage');
  const canReorder = canManage && canViewAllSites(ctx);
  const [{ data: activeSites }, { data: archivedSites }, foremanOptions] = await Promise.all([
    activeQuery,
    archivedPromise,
    canManage ? loadForemanOptions(supabase, ctx.tenant!.id) : Promise.resolve([]),
  ]);

  const allForCovers = [...(activeSites ?? []), ...(archivedSites ?? [])];
  const { documentPathById, signedUrls } = await loadSiteListCoverContext(
    supabase,
    ctx.tenant!.id,
    allForCovers,
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Baustellen</h1>
          <p>Stammdaten, Dokumente und Ansprechpartner je Baustelle.</p>
        </div>
        <div className="page-heading-actions">
          <Suspense fallback={null}>
            <SitesArchivedToggle />
          </Suspense>
          {canManage ? <SiteCreateDialog foremanOptions={foremanOptions} /> : null}
        </div>
      </div>

      <SitesListClient
        activeSites={activeSites ?? []}
        archivedSites={archivedSites ?? []}
        signedUrls={signedUrls}
        documentPathById={documentPathById}
        canReorder={canReorder}
        showArchived={showArchived}
      />
    </>
  );
}
