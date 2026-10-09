import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { PendingLeaveRow } from '@/lib/infoboard/types';

type Props = {
  rows: PendingLeaveRow[];
  totalPending: number;
};

export function LeavePendingWidget({ rows, totalPending }: Props) {
  return (
    <section className="panel schedule-panel infoboard-panel-widget">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Freigabe</span>
          <h2>Offene Urlaubsanträge</h2>
        </div>
        <Link href="/app/urlaub/freigabe" className="text-button">
          Zur Freigabe-Übersicht <ArrowRight size={16} />
        </Link>
      </div>
      <div className="job-list">
        {rows.map((entry) => (
          <Link className="job-row" key={entry.id} href="/app/urlaub/freigabe">
            <time>{entry.startDate}</time>
            <span className="job-marker travel" />
            <span className="job-copy">
              <strong>{entry.name}</strong>
              <small>
                {entry.leaveTypeLabel} · {entry.businessDays} T. · {entry.startDate} – {entry.endDate}
              </small>
            </span>
            <ChevronRight size={18} />
          </Link>
        ))}
        {!totalPending && <p className="muted">Keine offenen Anträge.</p>}
      </div>
      {totalPending > 5 && (
        <p className="approval-preview-count">
          + {totalPending - 5} weitere in der Freigabe-Übersicht
        </p>
      )}
    </section>
  );
}
