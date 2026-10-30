'use client';

import { useEffect, useId, useMemo, useState, useTransition } from 'react';
import { saveOrderCatalogItem } from '@/lib/actions/order-catalog';
import { CATEGORY_SIZE_KIND_LABELS, type SizePresetsMap } from '@/lib/orders/catalog-sizes';
import type { OrderCatalogCategory, OrderCatalogCategorySizeKind, OrderCatalogItem } from '@/lib/types/database';
import { AppDialog } from '@/components/ui/app-dialogs';
import { AppSelect } from '@/components/ui/app-select';

type Props = {
  open: boolean;
  onClose: () => void;
  categories: OrderCatalogCategory[];
  item: OrderCatalogItem | null;
  styleSuggestions: string[];
  seriesSuggestions: string[];
  sizePresets: SizePresetsMap;
};

type ImportSuggestion = {
  clothingStyle?: string;
  articleNumber?: string;
  price?: number;
  message?: string;
};

function formatPriceForInput(price: number | null | undefined): string {
  if (price == null) return '';
  return String(price).replace('.', ',');
}

function initialCategoryId(item: OrderCatalogItem | null, categories: OrderCatalogCategory[]) {
  return item?.category_id ?? categories[0]?.id ?? '';
}

function presetForCategory(
  sizeKind: OrderCatalogCategorySizeKind,
  sizePresets: SizePresetsMap,
): string[] {
  if (sizeKind === 'shoes') return sizePresets.shoes;
  if (sizeKind === 'custom') return [];
  return sizePresets.clothing;
}

function initialSizePriceInputs(
  item: OrderCatalogItem | null,
  offeredSizes: string[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const size of offeredSizes) {
    const v = item?.size_prices?.[size];
    map[size] = v != null ? formatPriceForInput(v) : '';
  }
  return map;
}

function initialSizesForItem(
  item: OrderCatalogItem | null,
  category: OrderCatalogCategory | undefined,
  sizePresets: SizePresetsMap,
): string[] {
  const sizeKind = category?.size_kind ?? 'clothing';
  if (sizeKind === 'custom') return item?.sizes ?? [];
  const base = presetForCategory(sizeKind, sizePresets);
  if (item?.sizes?.length) {
    const subset = item.sizes.filter((s) => base.includes(s));
    return subset.length > 0 ? subset : base;
  }
  return base;
}

function sizesToSubmit(selected: string[], sizeKind: OrderCatalogCategorySizeKind, sizePresets: SizePresetsMap): string[] {
  if (sizeKind === 'custom') return selected;
  const base = presetForCategory(sizeKind, sizePresets);
  if (selected.length >= base.length) return [];
  return selected;
}

type FormProps = {
  item: OrderCatalogItem | null;
  categories: OrderCatalogCategory[];
  styleSuggestions: string[];
  seriesSuggestions: string[];
  sizePresets: SizePresetsMap;
  onClose: () => void;
};

function OrderCatalogItemForm({
  item,
  categories,
  styleSuggestions,
  seriesSuggestions,
  sizePresets,
  onClose,
}: FormProps) {
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const [categoryId, setCategoryId] = useState(() => initialCategoryId(item, categories));
  const [articleNumber, setArticleNumber] = useState(() => item?.article_number ?? '');
  const [clothingStyle, setClothingStyle] = useState(() => item?.clothing_style ?? '');
  const [series, setSeries] = useState(() => item?.series ?? '');
  const [price, setPrice] = useState(() => formatPriceForInput(item?.price));
  const [shopUrl, setShopUrl] = useState(() => item?.shop_url ?? '');
  const [isActive, setIsActive] = useState(() => item?.is_active ?? true);
  const [sizeInput, setSizeInput] = useState('');
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId],
  );
  const sizeKind = selectedCategory?.size_kind ?? 'clothing';
  const initialSizes = initialSizesForItem(
    item,
    categories.find((c) => c.id === initialCategoryId(item, categories)),
    sizePresets,
  );
  const [sizes, setSizes] = useState<string[]>(() => initialSizes);
  const [sizePrices, setSizePrices] = useState<Record<string, string>>(() =>
    initialSizePriceInputs(item, initialSizes),
  );

  useEffect(() => {
    const nextSizes = initialSizesForItem(item, selectedCategory, sizePresets);
    setSizes(nextSizes);
    setSizePrices(initialSizePriceInputs(item, nextSizes));
    // Größenauswahl bei Kategoriewechsel zurücksetzen
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei categoryId
  }, [categoryId]);

  useEffect(() => {
    setSizePrices((prev) => {
      const next: Record<string, string> = {};
      for (const size of sizes) {
        next[size] = prev[size] ?? '';
      }
      return next;
    });
  }, [sizes]);

  function addSize() {
    const next = sizeInput.trim();
    if (!next || sizes.includes(next)) return;
    setSizes((prev) => [...prev, next]);
    setSizeInput('');
  }

  function removeSize(size: string) {
    setSizes((prev) => prev.filter((s) => s !== size));
  }

  async function importFromShop() {
    const url = shopUrl.trim();
    if (!url) {
      setImportError('Bitte zuerst einen Shop-Link eintragen.');
      return;
    }
    setFetching(true);
    setImportError(null);
    setImportMessage(null);
    try {
      const res = await fetch('/api/catalog/fetch-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as { error?: string; suggestion?: ImportSuggestion };
      if (!res.ok) {
        setImportError(data.error ?? 'Import fehlgeschlagen');
        return;
      }
      const s = data.suggestion ?? {};
      if (s.clothingStyle) setClothingStyle(s.clothingStyle);
      if (s.articleNumber) setArticleNumber(s.articleNumber);
      if (s.price != null) {
        const formatted = formatPriceForInput(s.price);
        setPrice(formatted);
        setSizePrices((prev) => {
          const next: Record<string, string> = { ...prev };
          for (const size of sizes) {
            next[size] = formatted;
          }
          return next;
        });
      }
      setImportMessage(s.message ?? 'Daten aus dem Shop übernommen. Bitte prüfen und ggf. anpassen.');
    } catch {
      setImportError('Import fehlgeschlagen');
    } finally {
      setFetching(false);
    }
  }

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <form
      className="input-form"
      action={(formData) => {
        startTransition(async () => {
          try {
            setImportError(null);
            await saveOrderCatalogItem(formData);
            onClose();
          } catch (e) {
            setImportError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
          }
        });
      }}
    >
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="is_active" value={isActive ? 'true' : 'false'} />
      {sizesToSubmit(sizes, sizeKind, sizePresets).map((size) => (
        <input key={size} type="hidden" name="sizes[]" value={size} />
      ))}

      <div className="input-form-core">
        <label>
          Kategorie
          <AppSelect
            name="category_id"
            value={categoryId}
            onValueChange={setCategoryId}
            allowEmpty={false}
            options={categoryOptions}
            disabled={!categoryOptions.length}
          />
        </label>
        <label>
          Artikelnummer
          <input name="article_number" value={articleNumber} onChange={(e) => setArticleNumber(e.target.value)} />
        </label>
        <label>
          Kleidungsstil
          <input
            name="clothing_style"
            required
            value={clothingStyle}
            onChange={(e) => setClothingStyle(e.target.value)}
            list={`${formId}-styles`}
          />
          <datalist id={`${formId}-styles`}>
            {styleSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label>
          Serie
          <input
            name="series"
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            list={`${formId}-series`}
          />
          <datalist id={`${formId}-series`}>
            {seriesSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label>
          Preis (EUR)
          <input name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="input-form-span-full">
          Link zum Online-Shop
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="min-w-0 flex-1"
              name="shop_url"
              type="url"
              value={shopUrl}
              onChange={(e) => setShopUrl(e.target.value)}
              placeholder="https://…"
            />
            <button
              type="button"
              className="secondary-button secondary-button--compact"
              onClick={() => void importFromShop()}
              disabled={fetching || pending}
            >
              {fetching ? 'Lädt…' : 'Aus Shop übernehmen'}
            </button>
          </div>
        </label>
      </div>

      <div className="input-form-extra-grid">
        {sizeKind === 'custom' ? (
          <>
            <label className="input-form-span-full">
              Verfügbare Größen (individuell)
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="min-w-0 flex-1"
                  value={sizeInput}
                  onChange={(e) => setSizeInput(e.target.value)}
                  placeholder="z. B. XL"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSize();
                    }
                  }}
                />
                <button type="button" className="secondary-button secondary-button--compact" onClick={addSize}>
                  Größe hinzufügen
                </button>
              </div>
            </label>
            {sizes.length > 0 && (
              <ul className="input-form-span-full flex flex-wrap gap-2">
                {sizes.map((size) => (
                  <li key={size}>
                    <button type="button" className="secondary-button secondary-button--compact" onClick={() => removeSize(size)}>
                      {size}
                      {' ×'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="input-form-span-full">
            <p className="muted" style={{ marginBottom: 8 }}>
              Standard: {CATEGORY_SIZE_KIND_LABELS[sizeKind]}. Optional nur bestimmte Größen für diesen Artikel anbieten
              (Größen pflegen unter{' '}
              <a href="/app/bestellungen?tab=katalog&katalog=groessen">Katalog → Größen</a>
              ).
            </p>
            <div className="flex flex-wrap gap-2">
              {presetForCategory(sizeKind, sizePresets).map((size) => {
                const checked = sizes.includes(size);
                return (
                  <label key={size} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSizes((prev) => {
                          const base = presetForCategory(sizeKind, sizePresets);
                          const next = checked ? prev.filter((s) => s !== size) : [...prev, size];
                          if (next.length === 0) return base;
                          return base.filter((s) => next.includes(s));
                        });
                      }}
                    />
                    {size}
                  </label>
                );
              })}
            </div>
          </div>
        )}
        {sizes.length > 0 && (
          <div className="input-form-span-full">
            <p className="muted" style={{ marginBottom: 8 }}>
              Preis pro Größe (optional). Leer lassen, wenn der allgemeine Preis (EUR) gelten soll.
            </p>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Größe</th>
                    <th>Preis (EUR)</th>
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((size) => (
                    <tr key={size}>
                      <td>{size}</td>
                      <td>
                        <input
                          name={`size_prices[${size}]`}
                          inputMode="decimal"
                          value={sizePrices[size] ?? ''}
                          onChange={(e) =>
                            setSizePrices((prev) => ({ ...prev, [size]: e.target.value }))
                          }
                          placeholder={price.trim() || '—'}
                          aria-label={`Preis Größe ${size}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <label className="input-form-span-full">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          {' '}
          Artikel ist aktiv (sichtbar für Bestellungen)
        </label>
      </div>

      {importError && <p className="form-error">{importError}</p>}
      {importMessage && !importError && <p className="muted">{importMessage}</p>}

      <div className="input-form-actions">
        <button type="button" className="secondary-button secondary-button--compact" onClick={onClose}>
          Abbrechen
        </button>
        <button type="submit" className="primary-button primary-button--compact" disabled={pending || !categoryId}>
          {pending ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
    </form>
  );
}

export function OrderCatalogItemDialog({
  open,
  onClose,
  categories,
  item,
  styleSuggestions,
  seriesSuggestions,
  sizePresets,
}: Props) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={item ? 'Artikel bearbeiten' : 'Artikel anlegen'}
      panelClassName="dialog-panel--wide"
    >
      {open && (
        <OrderCatalogItemForm
          key={item?.id ?? 'new'}
          item={item}
          categories={categories}
          styleSuggestions={styleSuggestions}
          seriesSuggestions={seriesSuggestions}
          sizePresets={sizePresets}
          onClose={onClose}
        />
      )}
    </AppDialog>
  );
}
