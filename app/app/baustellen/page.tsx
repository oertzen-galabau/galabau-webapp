import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { SiteCreateForm } from '@/components/sites/site-create-form';
import { SitesArchivedToggle } from '@/components/sites/sites-archived-toggle';
import { resolveAccessibleSiteIds } from '@/lib/sites/access';
import { formatSiteAddress } from '@/lib/sites/format-address';
import { loadForemanOptions } from '@/lib/sites/foremen-options';
import type { Site } from '@/lib/types/database';

type PageProps = {
  searchParams: Promise<{ archived?: string }>;
};

function SiteCard({ site, archived }: { site: Site; archived?: boolean }) {
  return (
    <Link key={site.id} href={`/app/baustellen/${site.id}`} className="document-card">
      <div className="document-preview"><span>🏗</span></div>
      <div>
        <span>{archived ? 'Archiviert' : 'Baustelle'}</span>
        <strong>{site.name}</strong>
        <small>{formatSiteAddress(site) ?? 'Keine Adresse'}</small>
      </div>
    </Link>
  );
}

export default async function BaustellenPage({ searchParams }: PageProps) {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.baustellen')) return <p className="muted">Keine Berechtigung.</p>;

  const { archived: archivedParam } = await searchParams;
  const showArchived = archivedParam === '1';

  const supabase = await createClient();
  const accessibleIds = await resolveAccessibleSiteIds(supabase, ctx);

  let activeQuery = supabase.from('sites').select('*').eq('is_active', true).order('name');
  if (accessibleIds !== null) {
    activeQuery = accessibleIds.length
      ? activeQuery.in('id', accessibleIds)
      : activeQuery.in('id', ['00000000-0000-0000-0000-000000000000']);
  }
  const archivedQuery = showArchived
    ? supabase.from('sites').select('*').eq('is_active', false).order('name')
    : Promise.resolve({ data: [] as Site[] });

  const canManage = canAccess(ctx, 'sites.manage');
  const [{ data: activeSites }, { data: archivedSites }, foremanOptions] = await Promise.all([
    activeQuery,
    archivedQuery,
    canManage ? loadForemanOptions(supabase, ctx.tenant!.id) : Promise.resolve([]),
  ]);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Baustellenakte</span>
          <h1>Baustellen</h1>
          <p>Stammdaten, Dokumente und Ansprechpartner je Baustelle.</p>
        </div>
        <Suspense fallback={null}>
          <SitesArchivedToggle />
        </Suspense>
      </div>

      {canManage && (
        <section className="panel form-panel">
          <h2>Neue Baustelle</h2>
          <SiteCreateForm foremanOptions={foremanOptions} />
        </section>
      )}

      {(activeSites ?? []).length === 0 && !(showArchived && (archivedSites ?? []).length > 0) ? (
        <p className="muted" style={{ marginTop: 16 }}>Noch keine aktiven Baustellen.</p>
      ) : (
        <div className="document-grid" style={{ marginTop: 16 }}>
          {(activeSites ?? []).map((site) => (
            <SiteCard key={site.id} site={site} />
          ))}
        </div>
      )}

      {showArchived && (
        <>
          <h2 style={{ marginTop: 28, marginBottom: 0, fontSize: 'var(--text-ui)', fontWeight: 600 }}>Archiviert</h2>
          {(archivedSites ?? []).length === 0 ? (
            <p className="muted">Keine archivierten Baustellen.</p>
          ) : (
            <div className="document-grid" style={{ marginTop: 12 }}>
              {(archivedSites ?? []).map((site) => (
                <SiteCard key={site.id} site={site} archived />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
