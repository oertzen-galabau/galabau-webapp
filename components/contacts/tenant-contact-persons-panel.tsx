import { createClient } from '@/lib/supabase/server';
import { canAccess, type SessionContext } from '@/lib/auth/session';
import { PartnerTabs } from '@/components/partners/partner-tabs';
import { TenantContactPersonCreateForm } from '@/components/contacts/tenant-contact-person-create-form';
import { TenantContactPersonRow } from '@/components/contacts/tenant-contact-person-row';
import type { TenantContactPerson } from '@/lib/types/database';

type Props = {
  ctx: SessionContext;
};

export async function TenantContactPersonsPanel({ ctx }: Props) {
  if (!canAccess(ctx, 'nav.partners') || !canAccess(ctx, 'partners.view')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const canManage = canAccess(ctx, 'partners.manage');
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('tenant_contact_persons')
    .select('*')
    .eq('tenant_id', ctx.tenant!.id)
    .order('is_active', { ascending: false })
    .order('name');

  const list = (rows ?? []) as TenantContactPerson[];

  return (
    <>
      <PartnerTabs activeTab="ansprechpartner" />

      {canManage ? (
        <section className="panel form-panel" style={{ marginTop: 16 }}>
          <h2>Neu anlegen</h2>
          <p className="muted">
            Ansprechpartner für Baustellen (z. B. Bauleiter, Bauherr) zentral pflegen und in Baustellen zuordnen.
          </p>
          <TenantContactPersonCreateForm />
        </section>
      ) : null}

      <section className="panel partner-table-panel" style={{ marginTop: 16 }}>
        {list.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table partner-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Kontakt</th>
                  <th scope="col">Status</th>
                  {canManage ? <th scope="col" className="partner-table-actions-head">Aktionen</th> : null}
                </tr>
              </thead>
              <tbody>
                {list.map((person) => (
                  <TenantContactPersonRow key={person.id} person={person} canManage={canManage} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted" style={{ padding: '1rem 1.25rem' }}>
            Noch keine Ansprechpartner hinterlegt.
            {canManage ? ' Legen Sie oben den ersten an.' : ' Bitte an die Verwaltung wenden.'}
          </p>
        )}
      </section>
    </>
  );
}
