import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { saveClothingOrder } from '@/lib/actions/employee';
import { AppSelect } from '@/components/ui/app-select';

const ITEM_TYPE_OPTIONS = [
  { value: 'schuhe', label: 'Schuhe' },
  { value: 'hose', label: 'Hose' },
  { value: 'jacke', label: 'Jacke' },
  { value: 'shirt', label: 'Shirt' },
];

export default async function BestellungenPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.bestellungen')) return <p className="muted">Keine Berechtigung.</p>;

  const supabase = await createClient();

  const { data: orders } = await supabase
    .from('clothing_orders')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false });

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Bestellungen</span>
          <h1>Schuhe & Kleidung</h1>
          <p>Bestellformular für Arbeitskleidung.</p>
        </div>
      </div>

      <section className="panel form-panel">
        <h2>Neue Bestellung</h2>
        <form action={saveClothingOrder} className="input-form">
          <div className="input-form-core">
            <label>Artikel
              <AppSelect
                name="item_type"
                defaultValue="schuhe"
                allowEmpty={false}
                options={ITEM_TYPE_OPTIONS}
              />
            </label>
            <label>Größe<input name="size" required /></label>
            <label>Menge<input type="number" name="quantity" min={1} defaultValue={1} /></label>
          </div>
          <details className="input-form-extra">
            <summary>Notiz</summary>
            <div className="input-form-extra-grid">
              <label className="input-form-span-full">Notiz<textarea name="notes" rows={2} /></label>
            </div>
          </details>
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Bestellen</button>
          </div>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Meine Bestellungen</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Datum</th><th>Artikel</th><th className="data-table-col--optional">Größe</th><th className="data-table-col--optional">Menge</th><th>Status</th></tr></thead>
            <tbody>
              {(orders ?? []).map((order) => (
                <tr key={order.id}>
                  <td>{new Date(order.created_at).toLocaleDateString('de-DE')}</td>
                  <td>{order.item_type}</td>
                  <td className="data-table-col--optional">{order.size}</td>
                  <td className="data-table-col--optional">{order.quantity}</td>
                  <td>{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
