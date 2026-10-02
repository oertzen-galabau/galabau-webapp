import type { OrderCatalogCategorySizeKind, OrderCatalogSizeKind } from '@/lib/types/database';

export const DEFAULT_CLOTHING_SIZES = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL',
] as const;

export const DEFAULT_SHOE_SIZES = [
  '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48',
] as const;

export type SizePresetsMap = Record<OrderCatalogSizeKind, string[]>;

export const CATEGORY_SIZE_KIND_LABELS: Record<OrderCatalogCategorySizeKind, string> = {
  clothing: 'Kleidung (Standard)',
  shoes: 'Schuhe (Standard)',
  custom: 'Individuell pro Artikel',
};

export function resolveItemSizeOptions(
  item: { sizes: string[] },
  categorySizeKind: OrderCatalogCategorySizeKind,
  presets: SizePresetsMap,
): string[] {
  if (categorySizeKind === 'custom') {
    return item.sizes ?? [];
  }
  const base = categorySizeKind === 'shoes' ? presets.shoes : presets.clothing;
  if (item.sizes?.length) {
    const allowed = new Set(base);
    const subset = item.sizes.filter((s) => allowed.has(s));
    return subset.length > 0 ? subset : base;
  }
  return base;
}

export function formatItemSizesDisplay(
  item: { sizes: string[] },
  categorySizeKind: OrderCatalogCategorySizeKind,
): string {
  if (categorySizeKind === 'custom') {
    return item.sizes?.length ? item.sizes.join(', ') : '—';
  }
  if (item.sizes?.length) {
    return item.sizes.join(', ');
  }
  return CATEGORY_SIZE_KIND_LABELS[categorySizeKind];
}
