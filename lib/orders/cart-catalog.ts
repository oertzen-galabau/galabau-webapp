export type CatalogCartGroup<C, I> = {
  category: C;
  items: I[];
};

export type CatalogSeriesGroup<I> = {
  series: string;
  items: I[];
};

type CatalogCategoryRef = { id: string };
type CatalogItemRef = {
  category_id: string;
  article_number: string | null;
  clothing_style: string;
  series: string | null;
};

export function catalogItemMatchesQuery(item: CatalogItemRef, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [item.article_number, item.clothing_style, item.series]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function compareCatalogItems(a: CatalogItemRef, b: CatalogItemRef): number {
  const seriesA = (a.series ?? '').trim();
  const seriesB = (b.series ?? '').trim();
  if (seriesA && !seriesB) return -1;
  if (!seriesA && seriesB) return 1;
  const seriesCmp = seriesA.localeCompare(seriesB, 'de');
  if (seriesCmp !== 0) return seriesCmp;
  const styleCmp = a.clothing_style.localeCompare(b.clothing_style, 'de');
  if (styleCmp !== 0) return styleCmp;
  return (a.article_number ?? '').localeCompare(b.article_number ?? '', 'de');
}

export function groupCatalogItemsByCategory<C extends CatalogCategoryRef, I extends CatalogItemRef>(
  categories: C[],
  items: I[],
): CatalogCartGroup<C, I>[] {
  const map = new Map<string, I[]>();
  for (const category of categories) map.set(category.id, []);
  for (const item of items) {
    const list = map.get(item.category_id) ?? [];
    list.push(item);
    map.set(item.category_id, list);
  }
  return categories
    .map((category) => ({
      category,
      items: [...(map.get(category.id) ?? [])].sort(compareCatalogItems),
    }))
    .filter((group) => group.items.length > 0);
}

export function filterCatalogCartGroups<C extends CatalogCategoryRef, I extends CatalogItemRef>(
  groups: CatalogCartGroup<C, I>[],
  opts: { categoryId: string | null; query: string },
): CatalogCartGroup<C, I>[] {
  return groups
    .filter((group) => !opts.categoryId || group.category.id === opts.categoryId)
    .map((group) => ({
      category: group.category,
      items: group.items.filter((item) => catalogItemMatchesQuery(item, opts.query)),
    }))
    .filter((group) => group.items.length > 0);
}

export function groupCatalogItemsBySeries<I extends { series: string | null }>(
  items: I[],
): CatalogSeriesGroup<I>[] {
  const groups: CatalogSeriesGroup<I>[] = [];
  const indexBySeries = new Map<string, number>();

  for (const item of items) {
    const series = (item.series ?? '').trim() || '—';
    let idx = indexBySeries.get(series);
    if (idx == null) {
      idx = groups.length;
      indexBySeries.set(series, idx);
      groups.push({ series, items: [] });
    }
    groups[idx].items.push(item);
  }

  return groups;
}
