import type { BudgetBreakdown } from '@/lib/orders/budget';
import { formatOrderEuro } from '@/lib/orders/labels';

type Props = {
  breakdown: BudgetBreakdown;
  compact?: boolean;
};

export function OrderBudgetMetrics({ breakdown, compact = false }: Props) {
  if (!breakdown.hasBudget) {
    return (
      <p className="muted">
        Für {breakdown.year} ist kein Kleidungsbudget hinterlegt — Bestellungen werden ohne Budgetgrenze erfasst.
      </p>
    );
  }

  if (compact) {
    return (
      <article className="metric-card">
        <span>Restbudget {breakdown.year}</span>
        <strong>{formatOrderEuro(breakdown.remainingEur)}</strong>
      </article>
    );
  }

  return (
    <div className="metric-grid">
      <article className="metric-card">
        <span>Budget {breakdown.year}</span>
        <strong>{formatOrderEuro(breakdown.budgetEur)}</strong>
      </article>
      <article className="metric-card">
        <span>Verbraucht</span>
        <strong>{formatOrderEuro(breakdown.usedEur)}</strong>
      </article>
      <article className="metric-card metric-feature">
        <span>Verbleibend</span>
        <strong>{formatOrderEuro(breakdown.remainingEur)}</strong>
      </article>
    </div>
  );
}
