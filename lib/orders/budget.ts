export type CartLineInput = {
  unitPriceEur: number | null;
  quantity: number;
};

export type OrderSplit = {
  budgetCoveredEur: number;
  ownShareEur: number;
};

export type BudgetBreakdown = {
  year: number;
  budgetEur: number | null;
  usedEur: number;
  remainingEur: number | null;
  hasBudget: boolean;
};

function roundEur(value: number): number {
  return Math.round(value * 100) / 100;
}

export function lineTotalEur(unitPriceEur: number | null, quantity: number): number {
  if (quantity <= 0) return 0;
  const price = unitPriceEur ?? 0;
  return roundEur(price * quantity);
}

export function cartTotalEur(lines: CartLineInput[]): number {
  return roundEur(lines.reduce((sum, line) => sum + lineTotalEur(line.unitPriceEur, line.quantity), 0));
}

/** Aufteilung Gesamtsumme in Budgetanteil und Eigenanteil. */
export function splitOrderTotal(totalEur: number, budgetRemainingEur: number | null): OrderSplit {
  const total = roundEur(Math.max(0, totalEur));
  if (budgetRemainingEur === null) {
    return { budgetCoveredEur: total, ownShareEur: 0 };
  }
  const remaining = roundEur(Math.max(0, budgetRemainingEur));
  const budgetCoveredEur = roundEur(Math.min(total, remaining));
  const ownShareEur = roundEur(total - budgetCoveredEur);
  return { budgetCoveredEur, ownShareEur };
}

export function buildBudgetBreakdown(
  year: number,
  budgetEur: number | null,
  usedEur: number,
): BudgetBreakdown {
  const used = roundEur(Math.max(0, usedEur));
  if (budgetEur === null) {
    return { year, budgetEur: null, usedEur: used, remainingEur: null, hasBudget: false };
  }
  const budget = roundEur(Math.max(0, budgetEur));
  return {
    year,
    budgetEur: budget,
    usedEur: used,
    remainingEur: roundEur(Math.max(0, budget - used)),
    hasBudget: true,
  };
}
