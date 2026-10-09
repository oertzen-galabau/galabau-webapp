import { createClient } from '@/lib/supabase/server';
import { canAccess, type SessionContext } from '@/lib/auth/session';
import { PartnerTabs } from '@/components/partners/partner-tabs';
import { PartnerRow } from '@/components/partners/partner-row';
import { PartnerCreateForm } from '@/components/partners/partner-create-form';
import { EquipmentPanel } from '@/components/equipment/equipment-panel';
import { partnerKindFromTab, type PartnerTabId } from '@/lib/partners/kind';
import type { TenantBusinessPartner } from '@/lib/types/database';

type Props = {
  ctx: SessionContext;
  activePartnerTab: PartnerTabId;
};

export async function BusinessPartnersPanel({ ctx, activePartnerTab }: Props) {
  if (!canAccess(ctx, 'nav.partners') || !canAccess(ctx, 'partners.view')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  if (activePartnerTab === 'fahrzeuge') {
    return <EquipmentPanel ctx={ctx} />;
  }

  const kind = partnerKindFromTab(activePartnerTab);
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
      <PartnerTabs activeTab={activePartnerTab} />

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
