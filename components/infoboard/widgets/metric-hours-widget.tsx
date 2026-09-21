import { Clock3 } from 'lucide-react';
import { formatMinutes } from '@/lib/utils/time';

type Props = {
  totalMinutesToday: number;
  activeWorkers: number;
  totalWorkers: number;
};

export function MetricHoursWidget({ totalMinutesToday, activeWorkers, totalWorkers }: Props) {
  return (
    <article className="metric-card metric-feature infoboard-metric-widget">
      <div className="metric-icon"><Clock3 size={20} /></div>
      <span>Heute erfasst</span>
      <strong>{formatMinutes(totalMinutesToday)} <small>Std.</small></strong>
      <p><i /> {activeWorkers} von {totalWorkers} Mitarbeitenden aktiv</p>
    </article>
  );
}
