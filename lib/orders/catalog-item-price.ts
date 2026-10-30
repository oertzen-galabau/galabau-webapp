import { normalizePriceString } from '@/lib/catalog/normalize-price';
import { formatOrderEuro } from '@/lib/orders/labels';

export type CatalogPriceSource = {
  price: number | null;
  size_prices?: Record<string, number> | null;
};

/** Einzelpreis für eine Größe: Größenpreis, sonst Artikel-Fallback `price`. */
export function resolveCatalogUnitPriceEur(
  item: CatalogPriceSource,
  size: string,
): number | null {
  const key = size.trim();
  if (key && item.size_prices && typeof item.size_prices[key] === 'number') {
    const v = item.size_prices[key];
    if (Number.isFinite(v) && v >= 0) return v;
  }
  if (item.price != null) {
    const p = Number(item.price);
    if (Number.isFinite(p) && p >= 0) return p;
  }
  return null;
}

function collectDistinctPrices(item: CatalogPriceSource, offeredSizes: string[]): number[] {
  const set = new Set<number>();
  for (const size of offeredSizes) {
    const p = resolveCatalogUnitPriceEur(item, size);
    if (p != null) set.add(p);
  }
  if (set.size === 0 && item.price != null) {
    const p = Number(item.price);
    if (Number.isFinite(p) && p >= 0) set.add(p);
  }
  return [...set].sort((a, b) => a - b);
}

/** Anzeige in Katalog-Tabelle: ein Preis oder Spanne. */
export function formatCatalogItemPriceLabel(
  item: CatalogPriceSource,
  offeredSizes: string[],
): string {
  const distinct = collectDistinctPrices(item, offeredSizes);
  if (distinct.length === 0) return '—';
  if (distinct.length === 1) return formatOrderEuro(distinct[0]!);
  const min = distinct[0]!;
  const max = distinct[distinct.length - 1]!;
  if (min === max) return formatOrderEuro(min);
  return `${formatOrderEuro(min)} – ${formatOrderEuro(max)}`;
}

/** Formular → DB: nur erlaubte Größen, positive Beträge. */
export function normalizeSizePricesMap(
  raw: Record<string, number | null | undefined>,
  allowedSizes: string[],
): Record<string, number> {
  const allowed = new Set(allowedSizes.map((s) => s.trim()).filter(Boolean));
  const out: Record<string, number> = {};
  for (const [size, value] of Object.entries(raw)) {
    const key = size.trim();
    if (!key || !allowed.has(key)) continue;
    if (value == null || !Number.isFinite(value) || value < 0) continue;
    out[key] = Math.round(value * 100) / 100;
  }
  return out;
}

const SIZE_PRICE_FIELD_RE = /^size_prices\[(.+)\]$/;

/** Liest `size_prices[M]` etc. aus FormData. */
export function parseSizePricesFromForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    const m = SIZE_PRICE_FIELD_RE.exec(key);
    if (!m) continue;
    out[m[1]!] = String(value).trim();
  }
  return out;
}

export function parseSizePricesFromFormToNumbers(formData: FormData): Record<string, number | null> {
  const raw = parseSizePricesFromForm(formData);
  const out: Record<string, number | null> = {};
  for (const [size, text] of Object.entries(raw)) {
    if (!text) {
      out[size] = null;
      continue;
    }
    out[size] = normalizePriceString(text);
  }
  return out;
}
