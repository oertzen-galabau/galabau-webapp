import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { PendingApprovalRow } from '@/lib/infoboard/types';
import { formatMinutes } from '@/lib/utils/time';

type Props = {
  rows: PendingApprovalRow[];
  totalPending: number;
  emptyQuip: string;
};

export function PendingApprovalWidget({ rows, totalPending, emptyQuip }: Props) {
  return (
    <section className="panel schedule-panel infoboard-panel-widget">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Freigabe</span>
          <h2>Zeiten zur Freigabe</h2>
        </div>
        <Link href="/app/zeiten#freigabe" className="text-button">
          Zur Freigabe-Übersicht <ArrowRight size={16} />
        </Link>
      </div>
      <div className="job-list">
        {rows.map((entry) => (
          <Link className="job-row" key={entry.id} href="/app/zeiten#freigabe">
            <time>{entry.workDate}</time>
            <span className="job-marker travel" />
            <span className="job-copy">
              <strong>{entry.name}</strong>
              <small>{formatMinutes(entry.workMinutes)} Std.</small>
            </span>
            <ChevronRight size={18} />
          </Link>
        ))}
        {!totalPending && <p className="muted">{emptyQuip}</p>}
      </div>
      {totalPending > 5 && (
        <p className="approval-preview-count">
          + {totalPending - 5} weitere in der Freigabe-Übersicht
        </p>
      )}
    </section>
  );
}
