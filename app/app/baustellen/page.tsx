import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { saveSite } from '@/lib/actions/admin';

export default async function BaustellenPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.baustellen')) return <p className="muted">Keine Berechtigung.</p>;

  const supabase = await createClient();
  const { data: sites } = await supabase.from('sites').select('*').order('name');

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Baustellenakte</span>
          <h1>Baustellen</h1>
          <p>Stammdaten, Dokumente und Ansprechpartner je Baustelle.</p>
        </div>
      </div>

      {canAccess(ctx, 'sites.manage') && (
        <section className="panel form-panel">
          <h2>Neue Baustelle</h2>
          <form action={saveSite} className="input-form">
            <div className="input-form-core">
              <label>Name<input name="name" required /></label>
              <label>Kunde<input name="client_name" /></label>
              <label>Adresse<input name="address" /></label>
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

      <div className="document-grid" style={{ marginTop: 16 }}>
        {(sites ?? []).map((site) => (
          <Link key={site.id} href={`/app/baustellen/${site.id}`} className="document-card">
            <div className="document-preview"><span>🏗</span></div>
            <div>
              <span>Baustelle</span>
              <strong>{site.name}</strong>
              <small>{site.address ?? 'Keine Adresse'}</small>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
