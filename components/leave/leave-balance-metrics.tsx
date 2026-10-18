import type { LeaveBalanceBreakdown } from '@/lib/leave/balance';
import { formatCarryExpiryLabel, type LeaveCarryExpiry } from '@/lib/leave/carry-over';

type Props = {
  breakdown: LeaveBalanceBreakdown;
  carryExpiry?: LeaveCarryExpiry | null;
  /** Kompakte Zeile ohne Anspruch/Vorjahr (z. B. Team-Übersicht). */
  compact?: boolean;
  /** full = 7 Karten; grouped = 3 Karten (Mein Konto). */
  layout?: 'full' | 'grouped';
};

function carryHintText(
  carryExpiry: LeaveCarryExpiry | null | undefined,
  breakdown: LeaveBalanceBreakdown,
): string | undefined {
  if (carryExpiry && breakdown.beforeCarryExpiry) {
    return `verfällt ${formatCarryExpiryLabel(carryExpiry)}`;
  }
  if (breakdown.forfeitedCarry > 0) {
    return `${breakdown.forfeitedCarry.toFixed(1)} verfallen`;
  }
  return undefined;
}

function badWeatherTitle(breakdown: LeaveBalanceBreakdown): string {
  return `${breakdown.badWeatherDays} genutzt von ${breakdown.badWeatherAllowanceDays} Kontingent. Vom Resturlaub abgezogen: ${breakdown.badWeatherDeductionFromVacation} Tag(e).`;
}

export function LeaveBalanceMetrics({
  breakdown,
  carryExpiry,
  compact = false,
  layout = 'full',
}: Props) {
  if (compact) {
    return (
      <article className="metric-card">
        <span>Resturlaub</span>
        <strong>{breakdown.remaining.toFixed(1)}</strong>
      </article>
    );
  }

  const carryHint = carryHintText(carryExpiry, breakdown);
  const swTitle = badWeatherTitle(breakdown);

  if (layout === 'grouped') {
    return (
      <div className="metric-grid metric-grid--leave-grouped">
        <article className="metric-card metric-card--grouped">
          <span className="metric-card-group-title">Anspruch</span>
          <dl className="metric-card-rows">
            <div className="metric-card-row">
              <dt>Jahresanspruch</dt>
              <dd>{breakdown.entitlementDays}</dd>
            </div>
            <div className="metric-card-row" title={carryHint}>
              <dt>Resturlaub Vorjahr</dt>
              <dd>
                {breakdown.effectiveCarriedOver.toFixed(1)}
                {carryHint && <small className="metric-card-note">{carryHint}</small>}
              </dd>
            </div>
            <div className="metric-card-row">
              <dt>Gesamt (brutto)</dt>
              <dd>{breakdown.totalAvailable.toFixed(1)}</dd>
            </div>
          </dl>
        </article>
        <article className="metric-card metric-card--grouped">
          <span className="metric-card-group-title">Abzüge</span>
          <dl className="metric-card-rows">
            <div className="metric-card-row">
              <dt>Genutzt (Anträge)</dt>
              <dd>{breakdown.usedFromRequests}</dd>
            </div>
            <div className="metric-card-row">
              <dt>Betrieb/Brücke</dt>
              <dd>{breakdown.mandatoryDays}</dd>
            </div>
            <div className="metric-card-row" title={swTitle}>
              <dt>Schlechtwetter</dt>
              <dd>
                {breakdown.badWeatherDays}
                <small className="metric-card-row-fraction"> / {breakdown.badWeatherAllowanceDays}</small>
              </dd>
            </div>
          </dl>
        </article>
        <article className="metric-card metric-card--grouped metric-feature">
          <span>Rest</span>
          <strong>{breakdown.remaining.toFixed(1)}</strong>
        </article>
      </div>
    );
  }

  return (
    <div className="metric-grid">
      <article className="metric-card">
        <span>Jahresanspruch</span>
        <strong>{breakdown.entitlementDays}</strong>
      </article>
      <article className="metric-card" title={carryHint}>
        <span>Resturlaub Vorjahr</span>
        <strong>{breakdown.effectiveCarriedOver.toFixed(1)}</strong>
        {carryHint && <small className="metric-card-note">{carryHint}</small>}
      </article>
      <article className="metric-card">
        <span>Gesamt (brutto)</span>
        <strong>{breakdown.totalAvailable.toFixed(1)}</strong>
      </article>
      <article className="metric-card">
        <span>Genutzt (Anträge)</span>
        <strong>{breakdown.usedFromRequests}</strong>
      </article>
      <article className="metric-card">
        <span>Betrieb/Brücke</span>
        <strong>{breakdown.mandatoryDays}</strong>
      </article>
      <article className="metric-card" title={swTitle}>
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
