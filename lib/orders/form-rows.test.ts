import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CatalogOrderItem } from '@/lib/types/database';
import { catalogSumFromItems, groupItemsByCategory } from './form-rows';

function line(partial: Partial<CatalogOrderItem> & Pick<CatalogOrderItem, 'sort_order'>): CatalogOrderItem {
  return {
    id: partial.id ?? 'id',
    order_id: partial.order_id ?? 'order',
    tenant_id: partial.tenant_id ?? 'tenant',
    catalog_item_id: partial.catalog_item_id ?? 'cat',
    category_name: partial.category_name ?? 'Sonstiges',
    article_number: partial.article_number ?? null,
    clothing_style: partial.clothing_style ?? 'Artikel',
    series: partial.series ?? null,
    unit_price_eur: partial.unit_price_eur ?? null,
    size: partial.size ?? 'M',
    quantity: partial.quantity ?? 1,
    name_print: partial.name_print ?? null,
    line_total_eur: partial.line_total_eur ?? 0,
    sort_order: partial.sort_order,
  };
}

describe('order form rows', () => {
  it('sums catalog lines', () => {
    assert.equal(
      catalogSumFromItems([
        { line_total_eur: 10 },
        { line_total_eur: 25.5 },
      ]),
      35.5,
    );
  });

  it('groups by category preserving sort order of first appearance', () => {
    const items = [
      line({ sort_order: 0, category_name: 'Hosen', clothing_style: 'A', line_total_eur: 1 }),
      line({ sort_order: 1, category_name: 'Jacken', clothing_style: 'B', line_total_eur: 2 }),
      line({ sort_order: 2, category_name: 'Hosen', clothing_style: 'C', line_total_eur: 3 }),
    ];
    const groups = groupItemsByCategory(items);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].category, 'Hosen');
    assert.equal(groups[0].items.length, 2);
    assert.equal(groups[1].category, 'Jacken');
    assert.equal(catalogSumFromItems(items), 6);
  });
});
