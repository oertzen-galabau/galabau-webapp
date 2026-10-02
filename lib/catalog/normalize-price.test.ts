import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizePriceString } from './normalize-price';

describe('normalizePriceString', () => {
  it('parses German format', () => {
    assert.equal(normalizePriceString('49,99 €'), 49.99);
    assert.equal(normalizePriceString('1.234,56'), 1234.56);
  });

  it('parses US format', () => {
    assert.equal(normalizePriceString('$19.99'), 19.99);
    assert.equal(normalizePriceString('1,234.56'), 1234.56);
  });

  it('returns null for invalid', () => {
    assert.equal(normalizePriceString(''), null);
    assert.equal(normalizePriceString('abc'), null);
  });
});
