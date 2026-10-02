import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveItemSizeOptions } from '@/lib/orders/catalog-sizes';

describe('resolveItemSizeOptions', () => {
  const presets = {
    clothing: ['M', 'L', 'XL'],
    shoes: ['42', '43'],
  };

  it('uses tenant clothing preset when item has no subset', () => {
    assert.deepEqual(
      resolveItemSizeOptions({ sizes: [] }, 'clothing', presets),
      presets.clothing,
    );
  });

  it('uses subset when item limits sizes', () => {
    assert.deepEqual(
      resolveItemSizeOptions({ sizes: ['M', 'L'] }, 'clothing', presets),
      ['M', 'L'],
    );
  });

  it('uses custom item sizes only for custom categories', () => {
    assert.deepEqual(
      resolveItemSizeOptions({ sizes: ['5XL'] }, 'custom', presets),
      ['5XL'],
    );
  });
});
