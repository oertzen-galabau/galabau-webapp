import type { CatalogOrderItem } from '@/lib/types/database';

export type CategoryItemGroup = {
  category: string;
  items: CatalogOrderItem[];
};

/** Katalogsumme aus Positionen (ohne Eigenanteil). */
export function catalogSumFromItems(items: Pick<CatalogOrderItem, 'line_total_eur'>[]): number {
  return items.reduce((sum, line) => sum + Number(line.line_total_eur ?? 0), 0);
}

/** Positionen nach Kategorie gruppieren, Reihenfolge wie in der Bestellung (`sort_order`). */
export function groupItemsByCategory(items: CatalogOrderItem[]): CategoryItemGroup[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const groups: CategoryItemGroup[] = [];
  const indexByCategory = new Map<string, number>();

  for (const item of sorted) {
    const key = item.category_name.trim() || '—';
    let idx = indexByCategory.get(key);
    if (idx == null) {
      idx = groups.length;
      indexByCategory.set(key, idx);
      groups.push({ category: key, items: [] });
    }
    groups[idx].items.push(item);
  }

  return groups;
}

export function formatOrderFormDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
}
