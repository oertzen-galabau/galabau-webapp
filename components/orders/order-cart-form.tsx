'use client';

import { useMemo, useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';
import { submitCatalogOrder } from '@/lib/actions/orders';
import {
  cartTotalEur,
  splitOrderTotal,
  type BudgetBreakdown,
} from '@/lib/orders/budget';
import {
  filterCatalogCartGroups,
  groupCatalogItemsByCategory,
  groupCatalogItemsBySeries,
} from '@/lib/orders/cart-catalog';
import { resolveCatalogUnitPriceEur } from '@/lib/orders/catalog-item-price';
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

function selectedQtyForItems(items: CatalogItemForOrder[], lines: Record<string, LineState>): number {
  return items.reduce((sum, item) => sum + (lines[item.id]?.quantity ?? 0), 0);
}

export function OrderCartForm({ categories, items, budget, sizePresets }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(items.map((item) => [item.id, defaultLineState(item, sizePresets)])),
  );
  const [openCategoryIds, setOpenCategoryIds] = useState<Set<string>>(() => {
    const groups = groupCatalogItemsByCategory(categories, items);
    return groups.length === 1 ? new Set([groups[0].category.id]) : new Set();
  });

  const itemsByCategory = useMemo(
    () => groupCatalogItemsByCategory(categories, items),
    [categories, items],
  );

  const visibleGroups = useMemo(
    () => filterCatalogCartGroups(itemsByCategory, { categoryId: filterCategoryId, query }),
    [itemsByCategory, filterCategoryId, query],
  );

  const cartPreview = useMemo(() => {
    const cartLines = items
      .map((item) => {
        const line = lines[item.id];
        if (!line || line.quantity <= 0) return null;
        return {
          unitPriceEur: resolveCatalogUnitPriceEur(
            { price: item.price != null ? Number(item.price) : null, size_prices: item.size_prices ?? {} },
            line.size,
          ),
          quantity: line.quantity,
        };
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

  function setCategoryOpen(categoryId: string, open: boolean) {
    setOpenCategoryIds((prev) => {
      const next = new Set(prev);
      if (open) next.add(categoryId);
      else next.delete(categoryId);
      return next;
    });
  }

  function selectCategory(categoryId: string | null) {
    setFilterCategoryId(categoryId);
    if (categoryId) {
      setOpenCategoryIds(new Set([categoryId]));
      return;
    }
    if (query.trim()) {
      setOpenCategoryIds(new Set(itemsByCategory.map((group) => group.category.id)));
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    const nextGroups = filterCatalogCartGroups(itemsByCategory, {
      categoryId: filterCategoryId,
      query: value,
    });
    if (value.trim()) {
      setOpenCategoryIds(new Set(nextGroups.map((group) => group.category.id)));
    }
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
    <form action={handleSubmit} className="input-form order-cart-form">
      {items.map((item) => {
        const line = lines[item.id] ?? defaultLineState(item, sizePresets);
        return (
          <div key={item.id} className="hidden">
            <input type="hidden" name="catalog_item_id[]" value={item.id} />
            <input type="hidden" name="quantity[]" value={line.quantity} />
            <input type="hidden" name="size[]" value={line.size} />
            <input type="hidden" name="name_print[]" value={line.namePrint} />
          </div>
        );
      })}

      <div className="order-cart-toolbar">
        <label className="order-cart-search">
          <span className="sr-only">Artikel suchen</span>
          <input
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.preventDefault();
            }}
            placeholder="Artikel, Serie oder Nr. suchen"
          />
        </label>
        <div className="order-cart-chips" role="group" aria-label="Kategorien">
          <button
            type="button"
            aria-pressed={filterCategoryId === null}
            className={filterCategoryId === null ? 'order-cart-chip is-active' : 'order-cart-chip'}
            onClick={() => selectCategory(null)}
          >
            Alle
            <span className="order-cart-chip-count">{items.length}</span>
          </button>
          {itemsByCategory.map(({ category, items: catItems }) => {
            const selectedQty = selectedQtyForItems(catItems, lines);
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={filterCategoryId === category.id}
                className={filterCategoryId === category.id ? 'order-cart-chip is-active' : 'order-cart-chip'}
                onClick={() => selectCategory(category.id)}
              >
                {category.name}
                <span className="order-cart-chip-count">{catItems.length}</span>
                {selectedQty > 0 ? (
                  <span className="order-cart-chip-picked">{selectedQty}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <p className="muted">Keine Artikel für diese Suche.</p>
      ) : (
        visibleGroups.map(({ category, items: catItems }) => {
          const selectedQty = selectedQtyForItems(catItems, lines);
          const seriesGroups = groupCatalogItemsBySeries(catItems);
          const showSeriesHeaders = seriesGroups.length > 1;
          const isOpen = openCategoryIds.has(category.id);

          return (
            <details
              key={category.id}
              className="panel order-cart-category"
              open={isOpen}
              onToggle={(event) => {
                const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                if (nextOpen !== isOpen) setCategoryOpen(category.id, nextOpen);
              }}
            >
              <summary>
                <span className="order-cart-category-title">
                  <h2>{category.name}</h2>
                  <span className="muted">{catItems.length} Artikel</span>
                  {selectedQty > 0 ? (
                    <span className="order-cart-category-picked">
                      {selectedQty} gewählt
                    </span>
                  ) : null}
                </span>
                <ChevronDown className="order-cart-category-chevron" size={18} aria-hidden />
              </summary>
              <div className="order-cart-category-body">
                <div className="data-table-wrap">
                  <table className="data-table order-cart-table">
                    <thead>
                      <tr>
                        <th>Artikelnr.</th>
                        <th>Kleidungsstil</th>
                        <th>Serie</th>
                        <th>Preis</th>
                        <th>Größe</th>
                        <th>Menge</th>
                        <th>Namensdruck</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seriesGroups.map((seriesGroup) => (
                        <CatalogSeriesRows
                          key={`${category.id}-${seriesGroup.series}`}
                          series={seriesGroup.series}
                          showHeader={showSeriesHeaders}
                          items={seriesGroup.items}
                          lines={lines}
                          sizePresets={sizePresets}
                          onUpdateLine={updateLine}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          );
        })
      )}

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

function CatalogSeriesRows({
  series,
  showHeader,
  items,
  lines,
  sizePresets,
  onUpdateLine,
}: {
  series: string;
  showHeader: boolean;
  items: CatalogItemForOrder[];
  lines: Record<string, LineState>;
  sizePresets: SizePresetsMap;
  onUpdateLine: (itemId: string, patch: Partial<LineState>) => void;
}) {
  return (
    <>
      {showHeader ? (
        <tr className="order-cart-series-row">
          <td colSpan={7}>Serie {series}</td>
        </tr>
      ) : null}
      {items.map((item) => {
        const line = lines[item.id] ?? defaultLineState(item, sizePresets);
        const sizeOptions = itemSizeOptions(item, sizePresets).map((s) => ({ value: s, label: s }));
        return (
          <tr key={item.id}>
            <td className="oc-nr">{item.article_number ?? '—'}</td>
            <td className="oc-style">{item.clothing_style}</td>
            <td className="oc-series">{item.series ?? '—'}</td>
            <td className="oc-price">
              {formatOrderEuro(
                resolveCatalogUnitPriceEur(
                  {
                    price: item.price != null ? Number(item.price) : null,
                    size_prices: item.size_prices ?? {},
                  },
                  line.size,
                ),
              )}
            </td>
            <td className="oc-size" data-label="Größe">
              {sizeOptions.length > 0 ? (
                <AppSelect
                  value={line.size}
                  onValueChange={(v) => onUpdateLine(item.id, { size: v })}
                  options={sizeOptions}
                  allowEmpty={false}
                  aria-label={`Größe ${item.clothing_style}`}
                />
              ) : (
                <span className="muted">—</span>
              )}
            </td>
            <td className="oc-qty" data-label="Menge">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={line.quantity || ''}
                onChange={(e) => onUpdateLine(item.id, { quantity: Number(e.target.value) || 0 })}
                aria-label={`Menge ${item.clothing_style}`}
              />
            </td>
            <td className="oc-name" data-label="Namensdruck">
              <input
                value={line.namePrint}
                onChange={(e) => onUpdateLine(item.id, { namePrint: e.target.value })}
                placeholder="Name (optional)"
                aria-label={`Namensdruck ${item.clothing_style}`}
              />
            </td>
          </tr>
        );
      })}
    </>
  );
}
