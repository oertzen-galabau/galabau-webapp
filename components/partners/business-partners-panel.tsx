import { createClient } from '@/lib/supabase/server';
import { canAccess, type SessionContext } from '@/lib/auth/session';
import { PartnerTabs } from '@/components/partners/partner-tabs';
import { PartnerRow } from '@/components/partners/partner-row';
import { PartnerCreateForm } from '@/components/partners/partner-create-form';
import { EquipmentPanel } from '@/components/equipment/equipment-panel';
import { TenantContactPersonsPanel } from '@/components/contacts/tenant-contact-persons-panel';
import { loadPartnerCatalog } from '@/lib/partners/load-catalog';
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

  if (activePartnerTab === 'ansprechpartner') {
    return <TenantContactPersonsPanel ctx={ctx} />;
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
  const catalog = await loadPartnerCatalog(supabase, ctx.tenant!.id, kind);
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));

  return (
    <>
      <PartnerTabs activeTab={activePartnerTab} />

      {canManage && (
        <section className="panel form-panel" style={{ marginTop: 16 }}>
          <h2>Neu anlegen</h2>
          <PartnerCreateForm kind={kind} />
        </section>
      )}

      <section className="panel partner-table-panel" style={{ marginTop: 16 }}>
        {list.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table partner-table">
              <thead>
                <tr>
                  <th scope="col">Firma</th>
                  <th scope="col">Hauptkontakt</th>
                  <th scope="col" className="data-table-col--optional">Bemerkung</th>
                  <th scope="col">Status</th>
                  {canManage && <th scope="col" className="partner-table-actions-head">Aktionen</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((partner) => {
                  const nested = catalogById.get(partner.id);
                  return (
                    <PartnerRow
                      key={partner.id}
                      partner={partner}
                      locations={nested?.locations ?? []}
                      contacts={nested?.contacts ?? []}
                      canManage={canManage}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
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
