import Link from 'next/link';
import { ArrowRight, CalendarClock } from 'lucide-react';

type Props = {
  count: number;
};

export function LeavePendingWidget({ count }: Props) {
  return (
    <article className="metric-card infoboard-metric-widget">
      <div className="metric-icon"><CalendarClock size={20} /></div>
      <span>Offene Urlaubsanträge</span>
      <strong>{count}</strong>
      <p>
        <Link href="/app/urlaub/freigabe" className="text-button infoboard-inline-link">
          Zur Freigabe-Übersicht <ArrowRight size={14} />
        </Link>
      </p>
    </article>
  );
}
