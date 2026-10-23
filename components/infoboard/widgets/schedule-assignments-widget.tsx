import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import type { ScheduleRow } from '@/lib/infoboard/types';

export type ScheduleAssignmentsSection = {
  dayLabel: string;
  rows: ScheduleRow[];
  emptyMessage: string;
  planDayIso: string;
};

type Props = {
  title: string;
  planDayIso: string;
  sections: ScheduleAssignmentsSection[];
};

function ScheduleJobRow({ job }: { job: ScheduleRow }) {
  return (
    <Link className="job-row infoboard-schedule-job-row" href={job.href}>
      <span className="infoboard-schedule-job-time-wrap">
        <time>{job.time}</time>
        <span className={`job-marker ${job.tone}`} />
      </span>
      <span className="job-copy">
        <strong>{job.title}</strong>
        <small>{job.subtitle ?? job.place}</small>
        {job.subtitle ? <small className="muted">{job.place}</small> : null}
        {job.teamLines.length > 0 ? (
          <span className="infoboard-schedule-team-text" aria-label="Mitarbeiter">
            {job.teamLines.map((line) => (
              <span
                key={`${job.id}-${line.text}`}
                className={line.isForeman ? 'infoboard-schedule-team-name--foreman' : undefined}
              >
                {line.text}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      {job.teamLines.length > 0 ? (
        <span className="avatar-stack infoboard-schedule-avatar-stack" aria-hidden="true">
          {job.teamLines.slice(0, 5).map((line) => (
            <i key={`${job.id}-av-${line.text}`} title={line.text}>
              {line.initials}
            </i>
          ))}
          {job.teamLines.length > 5 ? (
            <i className="infoboard-schedule-avatar-more">+{job.teamLines.length - 5}</i>
          ) : null}
        </span>
      ) : (
        <span className="infoboard-schedule-avatar-stack infoboard-schedule-avatar-stack--empty" />
      )}
      <ChevronRight size={18} />
    </Link>
  );
}

export function ScheduleAssignmentsWidget({ title, planDayIso, sections }: Props) {
  const planHref = `/app/einsatzplanung?view=day&day=${planDayIso}`;

  return (
    <section className="panel schedule-panel infoboard-panel-widget infoboard-schedule-widget">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
        </div>
        <Link href={planHref} className="text-button">
          Einsatzplan <ArrowRight size={16} />
        </Link>
      </div>
      {sections.map((section, index) => (
        <div
          key={section.planDayIso}
          className={
            index > 0 ? 'infoboard-schedule-day-block infoboard-schedule-day-block--follow' : 'infoboard-schedule-day-block'
          }
        >
          <span className="eyebrow infoboard-schedule-day-eyebrow">{section.dayLabel}</span>
          <div className="job-list">
            {section.rows.map((job) => (
              <ScheduleJobRow key={job.id} job={job} />
            ))}
            {!section.rows.length && <p className="muted">{section.emptyMessage}</p>}
          </div>
        </div>
      ))}
    </section>
  );
}
