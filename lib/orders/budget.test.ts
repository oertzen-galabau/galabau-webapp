import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBudgetBreakdown,
  cartTotalEur,
  lineTotalEur,
  splitOrderTotal,
} from './budget';

describe('order budget calc', () => {
  it('computes line and cart totals', () => {
    assert.equal(lineTotalEur(49.99, 2), 99.98);
    assert.equal(lineTotalEur(null, 3), 0);
    assert.equal(
      cartTotalEur([
        { unitPriceEur: 10, quantity: 2 },
        { unitPriceEur: 5.5, quantity: 1 },
      ]),
      25.5,
    );
  });

  it('splits within budget', () => {
    const split = splitOrderTotal(80, 100);
    assert.equal(split.budgetCoveredEur, 80);
    assert.equal(split.ownShareEur, 0);
  });

  it('splits with own share when over budget', () => {
    const split = splitOrderTotal(120, 40);
    assert.equal(split.budgetCoveredEur, 40);
    assert.equal(split.ownShareEur, 80);
  });

  it('no budget means no own share', () => {
    const split = splitOrderTotal(200, null);
    assert.equal(split.budgetCoveredEur, 200);
    assert.equal(split.ownShareEur, 0);
  });

  it('builds breakdown', () => {
    const b = buildBudgetBreakdown(2026, 500, 120);
    assert.equal(b.remainingEur, 380);
    assert.equal(b.hasBudget, true);
  });
});
