import { updateDefaultClothingOrderBudget } from '@/lib/actions/orders';

type Props = {
  defaultBudgetEur: number | null;
};

export function TenantOrderBudgetForm({ defaultBudgetEur }: Props) {
  const display = defaultBudgetEur != null ? String(defaultBudgetEur).replace('.', ',') : '';

  return (
    <section className="panel form-panel">
      <h2>Bestellbudget</h2>
      <p className="muted">
        Standard-Jahresbudget pro Mitarbeiter für Arbeitskleidung. Individuelle Werte können im Team pro Person gesetzt werden.
      </p>
      <form action={updateDefaultClothingOrderBudget} className="input-form">
        <div className="input-form-core">
          <label>
            Standard-Budget (EUR / Jahr)
            <input
              name="default_clothing_order_budget_eur"
              inputMode="decimal"
              defaultValue={display}
              placeholder="z. B. 500"
            />
          </label>
        </div>
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact">Speichern</button>
        </div>
      </form>
    </section>
  );
}
