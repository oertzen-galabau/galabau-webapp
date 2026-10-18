import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { uvvUrgencyJobMarkerClass } from '@/lib/equipment/labels';
import { partnerSettingsListPath } from '@/lib/partners/paths';
import type { EquipmentUvvRow } from '@/lib/infoboard/types';

type Props = {
  rows: EquipmentUvvRow[];
  totalCount: number;
};

const equipmentListHref = partnerSettingsListPath('fahrzeuge');

export function EquipmentUvvDueWidget({ rows, totalCount }: Props) {
  return (
    <section className="panel schedule-panel infoboard-panel-widget">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Stammdaten</span>
          <h2>UVV-Fälligkeit</h2>
        </div>
        <Link href={equipmentListHref} className="text-button">
          Zu Fahrzeuge & Geräte <ArrowRight size={16} />
        </Link>
      </div>
      <div className="job-list">
        {rows.map((entry) => (
          <Link className="job-row" key={entry.id} href={equipmentListHref}>
            <time>{entry.dueDate}</time>
            <span className={uvvUrgencyJobMarkerClass(entry.urgency)} />
            <span className="job-copy">
              <strong>{entry.name}</strong>
              <small>
                {entry.kindLabel}
                {entry.subtitle ? ` · ${entry.subtitle}` : ''}
              </small>
            </span>
            <ChevronRight size={18} />
          </Link>
        ))}
        {!totalCount && <p className="muted">Keine UVV-Termine hinterlegt.</p>}
      </div>
      {totalCount > rows.length && (
        <p className="approval-preview-count">
          + {totalCount - rows.length} weitere unter Fahrzeuge & Geräte
        </p>
      )}
    </section>
  );
}
