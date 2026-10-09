import type { LeaveBalanceBreakdown } from '@/lib/leave/balance';

type Props = {
  breakdown: LeaveBalanceBreakdown;
  /** Kompakte Zeile ohne Anspruch/Vorjahr (z. B. Team-Übersicht). */
  compact?: boolean;
};

export function LeaveBalanceMetrics({ breakdown, compact = false }: Props) {
  if (compact) {
    return (
      <article className="metric-card">
        <span>Resturlaub</span>
        <strong>{breakdown.remaining.toFixed(1)}</strong>
      </article>
    );
  }

  return (
    <div className="metric-grid">
      <article className="metric-card">
        <span>Anspruch</span>
        <strong>{breakdown.entitlementDays}</strong>
      </article>
      <article className="metric-card">
        <span>Vorjahr</span>
        <strong>{breakdown.carriedOverDays}</strong>
      </article>
      <article className="metric-card">
        <span>Genutzt (Anträge)</span>
        <strong>{breakdown.usedFromRequests}</strong>
      </article>
      <article className="metric-card">
        <span>Betrieb/Brücke</span>
        <strong>{breakdown.mandatoryDays}</strong>
      </article>
      <article
        className="metric-card"
        title={`${breakdown.badWeatherDays} genutzt von ${breakdown.badWeatherAllowanceDays} Kontingent. Vom Resturlaub reserviert: ${breakdown.badWeatherDeductionFromVacation} Tage (Puffer auch ohne Buchung).`}
      >
        <span>Schlechtwetter</span>
        <strong>
          {breakdown.badWeatherDays}
          <small> / {breakdown.badWeatherAllowanceDays}</small>
        </strong>
      </article>
      <article className="metric-card metric-feature">
        <span>Rest</span>
        <strong>{breakdown.remaining.toFixed(1)}</strong>
      </article>
    </div>
  );
}
