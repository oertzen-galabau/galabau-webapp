'use client';

import { useMemo, useState, useTransition } from 'react';
import { submitCatalogOrder } from '@/lib/actions/orders';
import {
  cartTotalEur,
  splitOrderTotal,
  type BudgetBreakdown,
} from '@/lib/orders/budget';
import { resolveItemSizeOptions, type SizePresetsMap } from '@/lib/orders/catalog-sizes';
import { formatOrderEuro } from '@/lib/orders/labels';
import type { OrderCatalogCategory, OrderCatalogCategorySizeKind, OrderCatalogItem } from '@/lib/types/database';
import { AppSelect } from '@/components/ui/app-select';

export type CatalogItemForOrder = OrderCatalogItem & {
  order_catalog_categories: Pick<OrderCatalogCategory, 'name' | 'sort_order' | 'size_kind'> | null;
};

type Props = {
  categories: OrderCatalogCategory[];
  items: CatalogItemForOrder[];
  budget: BudgetBreakdown;
  sizePresets: SizePresetsMap;
};

type LineState = {
  quantity: number;
  size: string;
  namePrint: string;
};

function categorySizeKind(item: CatalogItemForOrder): OrderCatalogCategorySizeKind {
  return item.order_catalog_categories?.size_kind ?? 'clothing';
}

function itemSizeOptions(item: CatalogItemForOrder, sizePresets: SizePresetsMap): string[] {
  return resolveItemSizeOptions(item, categorySizeKind(item), sizePresets);
}

function defaultLineState(item: CatalogItemForOrder, sizePresets: SizePresetsMap): LineState {
  const options = itemSizeOptions(item, sizePresets);
  return {
    quantity: 0,
    size: options[0] ?? '',
    namePrint: '',
  };
}

export function OrderCartForm({ categories, items, budget, sizePresets }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(items.map((item) => [item.id, defaultLineState(item, sizePresets)])),
  );

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, CatalogItemForOrder[]>();
    for (const cat of categories) map.set(cat.id, []);
    for (const item of items) {
      const list = map.get(item.category_id) ?? [];
      list.push(item);
      map.set(item.category_id, list);
    }
    return categories
      .map((cat) => ({ category: cat, items: map.get(cat.id) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [categories, items]);

  const cartPreview = useMemo(() => {
    const cartLines = items
      .map((item) => {
        const line = lines[item.id];
        if (!line || line.quantity <= 0) return null;
        return { unitPriceEur: item.price != null ? Number(item.price) : null, quantity: line.quantity };
      })
      .filter(Boolean) as { unitPriceEur: number | null; quantity: number }[];
    const total = cartTotalEur(cartLines);
    const split = splitOrderTotal(total, budget.hasBudget ? budget.remainingEur : null);
    return { total, ...split, lineCount: cartLines.length };
  }, [items, lines, budget]);

  function updateLine(itemId: string, patch: Partial<LineState>) {
    setLines((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], ...patch },
    }));
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      try {
        await submitCatalogOrder(formData);
        setLines(Object.fromEntries(items.map((item) => [item.id, defaultLineState(item, sizePresets)])));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Bestellung fehlgeschlagen');
      }
    });
  }

  if (items.length === 0) {
    return <p className="muted">Im Katalog sind noch keine aktiven Artikel hinterlegt.</p>;
  }

  return (
    <form action={handleSubmit} className="input-form">
      {items.map((item) => {
        const line = lines[item.id] ?? defaultLineState(item, sizePresets);
        const sizeOptions = itemSizeOptions(item, sizePresets).map((s) => ({ value: s, label: s }));
        return (
          <div key={item.id} className="hidden">
            <input type="hidden" name="catalog_item_id[]" value={item.id} />
            <input type="hidden" name="quantity[]" value={line.quantity} />
            <input type="hidden" name="size[]" value={line.size} />
            <input type="hidden" name="name_print[]" value={line.namePrint} />
          </div>
        );
      })}

      {itemsByCategory.map(({ category, items: catItems }) => (
        <section key={category.id} className="panel" style={{ marginBottom: 16 }}>
          <h2>{category.name}</h2>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Artikelnr.</th>
                  <th>Kleidungsstil</th>
                  <th className="data-table-col--optional">Serie</th>
                  <th>Preis</th>
                  <th>Größe</th>
                  <th>Menge</th>
                  <th className="data-table-col--optional">Namensdruck</th>
                </tr>
              </thead>
              <tbody>
                {catItems.map((item) => {
                  const line = lines[item.id] ?? defaultLineState(item, sizePresets);
                  const sizeOptions = itemSizeOptions(item, sizePresets).map((s) => ({ value: s, label: s }));
                  return (
                    <tr key={item.id}>
                      <td>{item.article_number ?? '—'}</td>
                      <td>{item.clothing_style}</td>
                      <td className="data-table-col--optional">{item.series ?? '—'}</td>
                      <td>{item.price != null ? formatOrderEuro(Number(item.price)) : '—'}</td>
                      <td>
                        {sizeOptions.length > 0 ? (
                          <AppSelect
                            value={line.size}
                            onValueChange={(v) => updateLine(item.id, { size: v })}
                            options={sizeOptions}
                            allowEmpty={false}
                            aria-label={`Größe ${item.clothing_style}`}
                          />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          value={line.quantity || ''}
                          onChange={(e) => updateLine(item.id, { quantity: Number(e.target.value) || 0 })}
                          aria-label={`Menge ${item.clothing_style}`}
                          style={{ maxWidth: 80 }}
                        />
                      </td>
                      <td className="data-table-col--optional">
                        <input
                          value={line.namePrint}
                          onChange={(e) => updateLine(item.id, { namePrint: e.target.value })}
                          placeholder="Name (optional)"
                          aria-label={`Namensdruck ${item.clothing_style}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="panel form-panel">
        <h2>Zusammenfassung</h2>
        <div className="metric-grid">
          <article className="metric-card">
            <span>Summe Katalog</span>
            <strong>{formatOrderEuro(cartPreview.total)}</strong>
          </article>
          {budget.hasBudget && (
            <>
              <article className="metric-card">
                <span>Davon Budget</span>
                <strong>{formatOrderEuro(cartPreview.budgetCoveredEur)}</strong>
              </article>
              <article className="metric-card metric-feature">
                <span>Eigenanteil</span>
                <strong>{formatOrderEuro(cartPreview.ownShareEur)}</strong>
              </article>
            </>
          )}
        </div>
        {budget.hasBudget && cartPreview.ownShareEur > 0 && (
          <p className="muted">Der Eigenanteil wird über den verbleibenden Katalogwert hinaus von Ihnen getragen.</p>
        )}

        <div className="input-form-extra-grid" style={{ marginTop: 16 }}>
          <label className="input-form-span-full">
            Notiz
            <textarea name="notes" rows={2} placeholder="Optional" />
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="input-form-actions">
          <button
            type="submit"
            className="primary-button primary-button--compact"
            disabled={pending || cartPreview.lineCount === 0}
          >
            {pending ? 'Wird gesendet…' : 'Bestellung absenden'}
          </button>
        </div>
      </section>
    </form>
  );
}
