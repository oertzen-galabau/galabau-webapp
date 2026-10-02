import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { PartnerTabs } from '@/components/partners/partner-tabs';
import { PartnerRow } from '@/components/partners/partner-row';
import { PartnerCreateForm } from '@/components/partners/partner-create-form';
import { isPartnerTab, partnerKindFromTab, type PartnerTabId } from '@/lib/partners/kind';
import type { TenantBusinessPartner } from '@/lib/types/database';

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function GeschaeftspartnerPage({ searchParams }: PageProps) {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.partners') || !canAccess(ctx, 'partners.view')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const { tab: tabParam } = await searchParams;
  const activeTab: PartnerTabId = isPartnerTab(tabParam) ? tabParam : 'subunternehmer';
  const kind = partnerKindFromTab(activeTab);
  const canManage = canAccess(ctx, 'partners.manage');

  const supabase = await createClient();
  const { data: partners } = await supabase
    .from('tenant_business_partners')
    .select('*')
    .eq('tenant_id', ctx.tenant!.id)
    .eq('kind', kind)
    .order('is_active', { ascending: false })
    .order('name');

  const list = (partners ?? []) as TenantBusinessPartner[];

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Stammdaten</span>
          <h1>Subunternehmer & Lieferanten</h1>
          <p>Zentrale Liste für die Tagesdokumentation und Baustellen-Zuordnung.</p>
        </div>
      </div>

      <PartnerTabs activeTab={activeTab} />

      {canManage && (
        <section className="panel form-panel" style={{ marginTop: 16 }}>
          <h2>Neu anlegen</h2>
          <PartnerCreateForm kind={kind} />
        </section>
      )}

      <section className="panel team-list" style={{ marginTop: 16 }}>
        {list.length > 0 ? (
          list.map((partner) => <PartnerRow key={partner.id} partner={partner} canManage={canManage} />)
        ) : (
          <p className="muted" style={{ padding: '1rem 1.25rem' }}>
            Noch keine Einträge in dieser Kategorie.
            {canManage ? ' Legen Sie oben den ersten an.' : ' Bitte an die Verwaltung wenden.'}
          </p>
        )}
      </section>
    </>
  );
}
