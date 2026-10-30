import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatOrderEuro } from '@/lib/orders/labels';
import {
  formatCatalogItemPriceLabel,
  normalizeSizePricesMap,
  resolveCatalogUnitPriceEur,
} from './catalog-item-price';

describe('catalog-item-price', () => {
  it('uses size-specific price when set', () => {
    assert.equal(
      resolveCatalogUnitPriceEur({ price: 10, size_prices: { M: 12, L: 14 } }, 'L'),
      14,
    );
  });

  it('falls back to item price', () => {
    assert.equal(
      resolveCatalogUnitPriceEur({ price: 10, size_prices: { M: 12 } }, 'XL'),
      10,
    );
  });

  it('returns null when no price', () => {
    assert.equal(resolveCatalogUnitPriceEur({ price: null, size_prices: {} }, 'M'), null);
  });

  it('formats single and range labels', () => {
    assert.equal(
      formatCatalogItemPriceLabel({ price: 29, size_prices: {} }, ['M', 'L']),
      formatOrderEuro(29),
    );
    assert.equal(
      formatCatalogItemPriceLabel({ price: 10, size_prices: { M: 12, L: 15 } }, ['M', 'L']),
      `${formatOrderEuro(12)} – ${formatOrderEuro(15)}`,
    );
  });

  it('normalizes size price map to allowed sizes only', () => {
    assert.deepEqual(
      normalizeSizePricesMap({ M: 12.345, XL: 99, S: -1 }, ['M', 'L']),
      { M: 12.35 },
    );
  });
});
