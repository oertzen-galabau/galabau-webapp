import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireTenantMember } from '@/lib/auth/session';
import { canAccess } from '@/lib/auth/session';
import { getSignedFileUrls } from '@/lib/supabase/storage';
import { SiteMetaForm } from '@/components/sites/site-meta-form';
import { SiteContactsSection } from '@/components/sites/site-contacts-section';
import { SiteSuppliersSection } from '@/components/sites/site-suppliers-section';
import { SiteAppointmentsSection } from '@/components/sites/site-appointments-section';
import { SiteDocumentsSection } from '@/components/sites/site-documents-section';
import { SiteWeatherSection } from '@/components/sites/site-weather-section';

export default async function BaustelleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.baustellen')) return <p className="muted">Keine Berechtigung.</p>;

  const supabase = await createClient();

  const [{ data: site }, { data: contacts }, { data: suppliers }, { data: documents }, { data: appointments }] = await Promise.all([
    supabase.from('sites').select('*').eq('id', id).single(),
    supabase.from('site_contacts').select('*').eq('site_id', id).order('name'),
    supabase.from('site_suppliers').select('*').eq('site_id', id).order('name'),
    supabase.from('site_documents').select('*').eq('site_id', id).order('created_at', { ascending: false }),
    supabase.from('site_appointments').select('*').eq('site_id', id).order('appointment_at'),
  ]);

  if (!site) notFound();

  const canEdit = canAccess(ctx, 'sites.manage');

  const docPaths = (documents ?? []).map((d) => d.file_url).filter(Boolean) as string[];
  const signedUrls = await getSignedFileUrls('site-documents', docPaths);

  const plans = (documents ?? []).filter((d) => d.category === 'plan');
  const lv = (documents ?? []).filter((d) => d.category === 'leistungsverzeichnis');
  const sonstige = (documents ?? []).filter((d) => !d.category || d.category === 'sonstiges');

  return (
    <>
      <div className="page-heading order-heading">
        <div>
          <span className="status-badge active">{site.is_active ? 'Aktiv' : 'Inaktiv'}</span>
          <h1>{site.name}</h1>
          <p>{site.address ?? '—'} · Kunde: {site.client_name ?? '—'}</p>
        </div>
      </div>

      <div className="order-layout">
        <section className="panel order-main">
          <SiteMetaForm site={site} canEdit={canEdit} />
          <SiteContactsSection siteId={id} contacts={contacts ?? []} canEdit={canEdit} />
          <SiteSuppliersSection siteId={id} suppliers={suppliers ?? []} canEdit={canEdit} />
        </section>

        <aside className="order-side">
          <section className="panel">
            <SiteWeatherSection site={site} />
          </section>

          <section className="panel">
            <SiteAppointmentsSection siteId={id} appointments={appointments ?? []} canEdit={canEdit} />
          </section>

          <section className="panel">
            <SiteDocumentsSection
              siteId={id}
              plans={plans}
              lv={lv}
              other={sonstige}
              signedUrls={signedUrls}
              canEdit={canEdit}
            />
          </section>
        </aside>
      </div>
    </>
  );
}
