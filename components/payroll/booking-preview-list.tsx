import type { BookingPreviewLine, PayrollBooking } from '@/lib/types/database';
import { formatMinutes } from '@/lib/utils/time';

type Props = {
  lines: BookingPreviewLine[] | PayrollBooking[];
  codeLabels?: Record<string, string>;
  warnings?: string[];
};

function formatQuantity(qty: number, unit: string) {
  if (unit === 'eur') return `${qty.toFixed(2)} €`;
  const clock = formatMinutes(Math.round(qty * 60));
  return `${qty.toFixed(2)} Std. (${clock})`;
}

export function BookingPreviewList({ lines, codeLabels, warnings = [] }: Props) {
  if (lines.length === 0 && warnings.length === 0) {
    return <p className="muted">Keine Buchungszeilen.</p>;
  }

  return (
    <div className="booking-preview">
      {lines.length > 0 && (
        <ul className="booking-preview-list">
          {lines.map((line, i) => {
            const code = line.booking_code;
            const label = 'label' in line && (line as BookingPreviewLine).label
              ? (line as BookingPreviewLine).label
              : codeLabels?.[code] ?? code;
            const unit = line.unit;
            const qty = Number(line.quantity);
            const source = 'source' in line ? (line as PayrollBooking).source : undefined;
            return (
              <li key={i}>
                <strong>{code}</strong> {label}: {formatQuantity(qty, unit)}
                {source === 'manual' && <span className="muted"> (manuell)</span>}
              </li>
            );
          })}
        </ul>
      )}
      {warnings.map((w) => (
        <p key={w} className="callout callout-warning" style={{ marginTop: 8 }}>{w}</p>
      ))}
    </div>
  );
}
