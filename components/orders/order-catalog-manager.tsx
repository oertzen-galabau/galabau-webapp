'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  deleteOrderCatalogCategory,
  renameOrderCatalogCategory,
  saveOrderCatalogCategory,
  setOrderCatalogItemActive,
} from '@/lib/actions/order-catalog';
import { formatCatalogItemPriceLabel } from '@/lib/orders/catalog-item-price';
import {
  CATEGORY_SIZE_KIND_LABELS,
  formatItemSizesDisplay,
  resolveItemSizeOptions,
  type SizePresetsMap,
} from '@/lib/orders/catalog-sizes';
import type { CatalogSubTabId } from '@/lib/orders/tabs';
import type { OrderCatalogCategory, OrderCatalogCategorySizeKind, OrderCatalogItem, OrderCatalogSizeOption } from '@/lib/types/database';
import { OrderCatalogItemDialog } from '@/components/orders/order-catalog-item-dialog';
import { OrderCatalogSizeManager } from '@/components/orders/order-catalog-size-manager';
import { OrderCatalogSubTabs } from '@/components/orders/order-catalog-sub-tabs';
import { AppSelect } from '@/components/ui/app-select';
import { ConfirmDialog } from '@/components/ui/app-dialogs';
import { EditIconAction, TableIconActions } from '@/components/ui/icon-action-button';

type ItemRow = OrderCatalogItem & {
  order_catalog_categories: Pick<OrderCatalogCategory, 'id' | 'name' | 'size_kind'> | null;
};

const CATEGORY_SIZE_KIND_OPTIONS: { value: OrderCatalogCategorySizeKind; label: string }[] = [
  { value: 'clothing', label: CATEGORY_SIZE_KIND_LABELS.clothing },
  { value: 'shoes', label: CATEGORY_SIZE_KIND_LABELS.shoes },
  { value: 'custom', label: CATEGORY_SIZE_KIND_LABELS.custom },
];

type Props = {
  categories: OrderCatalogCategory[];
  items: ItemRow[];
  activeSubTab: CatalogSubTabId;
  sizePresets: SizePresetsMap;
  sizeOptionRows: OrderCatalogSizeOption[];
};

export function OrderCatalogManager({ categories, items, activeSubTab, sizePresets, sizeOptionRows }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filterCategory, setFilterCategory] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<OrderCatalogItem | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  const styleSuggestions = useMemo(
    () => [...new Set(items.map((i) => i.clothing_style.trim()).filter(Boolean))].sort(),
    [items],
  );
  const seriesSuggestions = useMemo(
    () => [...new Set(items.map((i) => (i.series ?? '').trim()).filter(Boolean))].sort(),
    [items],
  );

  const filteredItems = items.filter((item) => {
    if (filterCategory && item.category_id !== filterCategory) return false;
    if (!showInactive && !item.is_active) return false;
    return true;
  });

  const categoryFilterOptions = [
    { value: '', label: 'Alle Kategorien' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  function refresh() {
    router.refresh();
  }

  function openCreate() {
    setEditItem(null);
    setDialogOpen(true);
  }

  function openEdit(item: OrderCatalogItem) {
    setEditItem(item);
    setDialogOpen(true);
  }

  function toggleActive(item: OrderCatalogItem) {
    const formData = new FormData();
    formData.set('id', item.id);
    formData.set('is_active', item.is_active ? 'false' : 'true');
    startTransition(async () => {
      await setOrderCatalogItemActive(formData);
      refresh();
    });
  }

  return (
    <>
      <OrderCatalogSubTabs activeSubTab={activeSubTab} />

      {activeSubTab === 'kategorie' && (
      <section className="panel form-panel" style={{ marginTop: 16 }}>
        <h2>Kategorien</h2>
        <p className="muted">Kategorien legen die Struktur Ihres Betriebskatalogs fest.</p>

        {categories.length > 0 && (
          <ul className="site-entity-list">
            {categories.map((cat) => (
              <li key={cat.id} className="site-entity-row">
                <form
                  action={async (formData) => {
                    setCategoryError(null);
                    try {
                      await renameOrderCatalogCategory(formData);
                      refresh();
                    } catch (e) {
                      setCategoryError(e instanceof Error ? e.message : 'Fehler');
                    }
                  }}
                  className="flex flex-wrap items-end gap-2"
                >
                  <input type="hidden" name="id" value={cat.id} />
                  <label className="min-w-[200px] flex-1">
                    <input
                      name="name"
                      defaultValue={cat.name}
                      required
                      aria-label="Kategoriename"
                    />
                  </label>
                  <label>
                    Größenart
                    <AppSelect
                      name="size_kind"
                      defaultValue={cat.size_kind ?? 'clothing'}
                      options={CATEGORY_SIZE_KIND_OPTIONS}
                      allowEmpty={false}
                      aria-label="Größenart"
                    />
                  </label>
                  <button type="submit" className="secondary-button secondary-button--compact" disabled={pending}>
                    Speichern
                  </button>
                </form>
                <TableIconActions>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setDeleteCategoryId(cat.id)}
                  >
                    Löschen
                  </button>
                </TableIconActions>
              </li>
            ))}
          </ul>
        )}

        <form
          action={async (formData) => {
            setCategoryError(null);
            try {
              await saveOrderCatalogCategory(formData);
              refresh();
            } catch (e) {
              setCategoryError(e instanceof Error ? e.message : 'Fehler');
            }
          }}
          className="input-form"
          style={{ marginTop: 16 }}
        >
          <div className="input-form-core">
            <label>
              Neue Kategorie
              <input name="name" required placeholder="z. B. Schuhe" />
            </label>
            <label>
              Größenart
              <AppSelect
                name="size_kind"
                defaultValue="clothing"
                options={CATEGORY_SIZE_KIND_OPTIONS}
                allowEmpty={false}
              />
            </label>
          </div>
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
              Kategorie anlegen
            </button>
          </div>
        </form>
        {categoryError && <p className="form-error">{categoryError}</p>}
      </section>
      )}

      {activeSubTab === 'artikel' && (
      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <div>
            <h2>Artikel</h2>
            <p className="muted">Pflegen Sie Artikelnummer, Stil, Serie, Preis und Shop-Link.</p>
          </div>
          <button
            type="button"
            className="primary-button primary-button--compact"
            onClick={openCreate}
            disabled={categories.length === 0}
          >
            Artikel anlegen
          </button>
        </div>

        {categories.length === 0 && (
          <p className="muted">
            Legen Sie zuerst mindestens eine Kategorie an (
            <Link href="/app/bestellungen?tab=katalog&katalog=kategorie">Kategorie</Link>
            ).
          </p>
        )}

        {categories.length > 0 && (
          <>
            <div className="flex flex-wrap items-end gap-4" style={{ marginBottom: 16 }}>
              <label>
                Filter
                <AppSelect
                  value={filterCategory}
                  onValueChange={setFilterCategory}
                  options={categoryFilterOptions}
                  allowEmpty={false}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Inaktive anzeigen
              </label>
            </div>

            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Kategorie</th>
                    <th>Artikelnr.</th>
                    <th>Kleidungsstil</th>
                    <th className="data-table-col--optional">Serie</th>
                    <th>Preis</th>
                    <th className="data-table-col--optional">Größen</th>
                    <th>Status</th>
                    <th aria-label="Aktionen" />
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.order_catalog_categories?.name ?? '—'}</td>
                      <td>{item.article_number ?? '—'}</td>
                      <td>{item.clothing_style}</td>
                      <td className="data-table-col--optional">{item.series ?? '—'}</td>
                      <td>
                        {formatCatalogItemPriceLabel(
                          {
                            price: item.price != null ? Number(item.price) : null,
                            size_prices: item.size_prices ?? {},
                          },
                          resolveItemSizeOptions(
                            item,
                            item.order_catalog_categories?.size_kind ?? 'clothing',
                            sizePresets,
                          ),
                        )}
                      </td>
                      <td className="data-table-col--optional">
                        {formatItemSizesDisplay(
                          item,
                          item.order_catalog_categories?.size_kind ?? 'clothing',
                        )}
                      </td>
                      <td>{item.is_active ? 'Aktiv' : 'Inaktiv'}</td>
                      <td>
                        <TableIconActions>
                          {item.shop_url && (
                            <a href={item.shop_url} target="_blank" rel="noopener noreferrer" className="text-button">
                              Shop
                            </a>
                          )}
                          <EditIconAction onClick={() => openEdit(item)} />
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => toggleActive(item)}
                            disabled={pending}
                          >
                            {item.is_active ? 'Deaktivieren' : 'Aktivieren'}
                          </button>
                        </TableIconActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredItems.length === 0 && <p className="muted">Keine Artikel für den Filter.</p>}
          </>
        )}
      </section>
      )}

      {activeSubTab === 'groessen' && (
        <div style={{ marginTop: 16 }}>
          <OrderCatalogSizeManager
            clothing={sizeOptionRows.filter((r) => r.kind === 'clothing')}
            shoes={sizeOptionRows.filter((r) => r.kind === 'shoes')}
          />
        </div>
      )}

      <OrderCatalogItemDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          refresh();
        }}
        categories={categories}
        item={editItem}
        styleSuggestions={styleSuggestions}
        seriesSuggestions={seriesSuggestions}
        sizePresets={sizePresets}
      />

      <ConfirmDialog
        open={deleteCategoryId != null}
        onClose={() => setDeleteCategoryId(null)}
        title="Kategorie löschen?"
        message="Die Kategorie kann nur gelöscht werden, wenn kein Artikel mehr zugeordnet ist."
        confirmLabel="Löschen"
        danger
        pending={pending}
        onConfirm={() => {
          if (!deleteCategoryId) return;
          const formData = new FormData();
          formData.set('id', deleteCategoryId);
          startTransition(async () => {
            try {
              setCategoryError(null);
              await deleteOrderCatalogCategory(formData);
              setDeleteCategoryId(null);
              refresh();
            } catch (e) {
              setCategoryError(e instanceof Error ? e.message : 'Fehler');
              setDeleteCategoryId(null);
            }
          });
        }}
      />
    </>
  );
}
