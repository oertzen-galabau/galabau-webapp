import Link from 'next/link';
import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { saveSite } from '@/lib/actions/admin';
import { SitesArchivedToggle } from '@/components/sites/sites-archived-toggle';
import { formatSiteAddress } from '@/lib/sites/format-address';
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

  const activeQuery = supabase.from('sites').select('*').eq('is_active', true).order('name');
  const archivedQuery = showArchived
    ? supabase.from('sites').select('*').eq('is_active', false).order('name')
    : Promise.resolve({ data: [] as Site[] });

  const [{ data: activeSites }, { data: archivedSites }] = await Promise.all([activeQuery, archivedQuery]);

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

      {canAccess(ctx, 'sites.manage') && (
        <section className="panel form-panel">
          <h2>Neue Baustelle</h2>
          <form action={saveSite} className="input-form">
            <div className="input-form-core">
              <label>Name<input name="name" required /></label>
              <label>Kunde<input name="client_name" /></label>
              <label>Straße mit Nr.<input name="street" /></label>
              <label>PLZ<input name="zip_code" /></label>
              <label>Ort<input name="city" /></label>
            </div>
            <details className="input-form-extra">
              <summary>Anfahrt & Notizen</summary>
              <div className="input-form-extra-grid">
                <label className="input-form-span-2">Anfahrt<textarea name="directions" rows={2} /></label>
                <label className="input-form-span-2">Notizen<textarea name="notes" rows={2} /></label>
              </div>
            </details>
            <div className="input-form-actions">
              <button type="submit" className="primary-button primary-button--compact">Anlegen</button>
            </div>
          </form>
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
