import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  catalogItemMatchesQuery,
  compareCatalogItems,
  filterCatalogCartGroups,
  groupCatalogItemsByCategory,
  groupCatalogItemsBySeries,
} from './cart-catalog';

const hosen = { id: 'hosen' };
const jacken = { id: 'jacken' };

function item(partial: {
  category_id: string;
  clothing_style: string;
  series?: string | null;
  article_number?: string | null;
}) {
  return {
    category_id: partial.category_id,
    clothing_style: partial.clothing_style,
    series: partial.series ?? null,
    article_number: partial.article_number ?? null,
  };
}

describe('cart catalog grouping', () => {
  it('groups by category sort order and sorts items by series then style', () => {
    const groups = groupCatalogItemsByCategory(
      [hosen, jacken],
      [
        item({ category_id: 'hosen', clothing_style: 'Latzhose', series: 'motion' }),
        item({ category_id: 'jacken', clothing_style: 'Regenjacke', series: 'active' }),
        item({ category_id: 'hosen', clothing_style: 'Bundhose', series: 'active' }),
        item({ category_id: 'hosen', clothing_style: 'Regenhose', series: null }),
      ],
    );

    assert.equal(groups.length, 2);
    assert.equal(groups[0].category.id, 'hosen');
    assert.deepEqual(
      groups[0].items.map((row) => row.clothing_style),
      ['Bundhose', 'Latzhose', 'Regenhose'],
    );
    assert.equal(groups[1].category.id, 'jacken');
  });

  it('filters by category and search query', () => {
    const groups = groupCatalogItemsByCategory(
      [hosen, jacken],
      [
        item({ category_id: 'hosen', clothing_style: 'Bundhose', series: 'motion', article_number: '65201' }),
        item({ category_id: 'hosen', clothing_style: 'Latzhose', series: 'active' }),
        item({ category_id: 'jacken', clothing_style: 'Softshelljacke', series: 'mo2020' }),
      ],
    );

    const byCategory = filterCatalogCartGroups(groups, { categoryId: 'hosen', query: '' });
    assert.equal(byCategory.length, 1);
    assert.equal(byCategory[0].items.length, 2);

    const byQuery = filterCatalogCartGroups(groups, { categoryId: null, query: 'softshell' });
    assert.equal(byQuery.length, 1);
    assert.equal(byQuery[0].items[0].clothing_style, 'Softshelljacke');

    const byArticle = filterCatalogCartGroups(groups, { categoryId: null, query: '65201' });
    assert.equal(byArticle[0].items.length, 1);
    assert.equal(byArticle[0].items[0].clothing_style, 'Bundhose');
  });

  it('groups items by series in first-seen order', () => {
    const grouped = groupCatalogItemsBySeries([
      item({ category_id: 'hosen', clothing_style: 'A', series: 'motion' }),
      item({ category_id: 'hosen', clothing_style: 'B', series: 'active' }),
      item({ category_id: 'hosen', clothing_style: 'C', series: 'motion' }),
      item({ category_id: 'hosen', clothing_style: 'D', series: null }),
    ]);
    assert.deepEqual(
      grouped.map((g) => [g.series, g.items.length]),
      [
        ['motion', 2],
        ['active', 1],
        ['—', 1],
      ],
    );
  });

  it('matches query against style, series and article number', () => {
    const row = item({
      category_id: 'hosen',
      clothing_style: 'Bundhose',
      series: 'mo2020',
      article_number: '65541',
    });
    assert.equal(catalogItemMatchesQuery(row, ''), true);
    assert.equal(catalogItemMatchesQuery(row, '  BUND  '), true);
    assert.equal(catalogItemMatchesQuery(row, 'mo20'), true);
    assert.equal(catalogItemMatchesQuery(row, '65541'), true);
    assert.equal(catalogItemMatchesQuery(row, 'jacke'), false);
  });

  it('puts items without series after named series', () => {
    const unnamed = item({ category_id: 'p', clothing_style: 'Stricktroyer', series: null });
    const named = item({ category_id: 'p', clothing_style: 'Hoody', series: 'poly cotton' });
    assert.ok(compareCatalogItems(named, unnamed) < 0);
  });
});
