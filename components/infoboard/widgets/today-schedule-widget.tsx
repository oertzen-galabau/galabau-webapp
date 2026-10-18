import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { ScheduleRow } from '@/lib/infoboard/types';

type Props = {
  dateLabel: string;
  rows: ScheduleRow[];
};

export function TodayScheduleWidget({ dateLabel, rows }: Props) {
  return (
    <section className="panel schedule-panel infoboard-panel-widget">
      <div className="panel-head">
        <div>
          <span className="eyebrow">{dateLabel}</span>
          <h2>Heutige Einsätze</h2>
        </div>
        <Link href="/app/einsatzplanung" className="text-button">
          Einsatzplan <ArrowRight size={16} />
        </Link>
      </div>
      <div className="job-list">
        {rows.map((job) => (
          <Link className="job-row" key={job.id} href={job.href}>
            <time>{job.time}</time>
            <span className={`job-marker ${job.tone}`} />
            <span className="job-copy">
              <strong>{job.title}</strong>
              <small>{job.subtitle ?? job.place}</small>
              {job.subtitle ? <small className="muted">{job.place}</small> : null}
            </span>
            <ChevronRight size={18} />
          </Link>
        ))}
        {!rows.length && <p className="muted">Keine Einsätze für heute geplant.</p>}
      </div>
    </section>
  );
}
