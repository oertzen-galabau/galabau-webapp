import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { MyLeaveRow } from '@/lib/infoboard/types';

type Props = {
  rows: MyLeaveRow[];
};

const STATUS_LABEL: Record<MyLeaveRow['status'], string> = {
  pending: 'Offen',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
};

export function LeaveMineWidget({ rows }: Props) {
  return (
    <section className="panel schedule-panel infoboard-panel-widget">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Abwesenheit</span>
          <h2>Meine Urlaubsanträge</h2>
        </div>
        <Link href="/app/urlaub" className="text-button">
          Urlaubskonto <ArrowRight size={16} />
        </Link>
      </div>
      <div className="job-list">
        {rows.map((entry) => (
          <Link
            className={`job-row${entry.status === 'rejected' ? ' job-row--alert' : ''}`}
            key={entry.id}
            href="/app/urlaub"
          >
            <time>{entry.startDate}</time>
            <span
              className={`job-marker${entry.status === 'approved' ? ' active' : entry.status === 'rejected' ? ' travel' : ''}`}
            />
            <span className="job-copy">
              <strong>{entry.leaveTypeLabel}</strong>
              <small>
                {entry.startDate} – {entry.endDate} · {entry.businessDays} T. ·{' '}
                {STATUS_LABEL[entry.status]}
              </small>
            </span>
            <ChevronRight size={18} />
          </Link>
        ))}
        {!rows.length && (
          <p className="muted">Keine offenen oder kürzlich entschiedenen Anträge.</p>
        )}
      </div>
    </section>
  );
}
