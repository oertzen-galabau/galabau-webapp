import { Clock3 } from 'lucide-react';
import { formatMinutes } from '@/lib/utils/time';

type Props = {
  totalMinutesToday: number;
  activeWorkers: number;
  totalWorkers: number;
  showTeamStats: boolean;
  ownMinutesToday?: number;
};

export function MetricHoursWidget({
  totalMinutesToday,
  activeWorkers,
  totalWorkers,
  showTeamStats,
  ownMinutesToday = 0,
}: Props) {
  const displayMinutes = showTeamStats ? totalMinutesToday : ownMinutesToday;

  return (
    <article className="metric-card metric-feature infoboard-metric-widget">
      <div className="metric-icon"><Clock3 size={20} /></div>
      <span>{showTeamStats ? 'Heute erfasst' : 'Meine Stunden heute'}</span>
      <strong>{formatMinutes(displayMinutes)} <small>Std.</small></strong>
      {showTeamStats ? (
        <p><i /> {activeWorkers} von {totalWorkers} Mitarbeitenden aktiv</p>
      ) : (
        <p><i /> Erfassung über „Zeit erfassen“ oben im Header</p>
      )}
    </article>
  );
}
