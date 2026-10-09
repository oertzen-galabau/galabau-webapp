import Link from 'next/link';
import { Clock3 } from 'lucide-react';
import { formatMinutes } from '@/lib/utils/time';

type Props = {
  totalMinutesToday: number;
  showTeamStats: boolean;
  ownMinutesToday?: number;
  rejectedCount?: number;
};

export function MetricHoursWidget({
  totalMinutesToday,
  showTeamStats,
  ownMinutesToday = 0,
  rejectedCount = 0,
}: Props) {
  const displayMinutes = showTeamStats ? totalMinutesToday : ownMinutesToday;

  return (
    <article className="metric-card metric-feature infoboard-metric-widget infoboard-metric-widget--zeiten">
      <div className="metric-icon"><Clock3 size={20} /></div>
      <span>{showTeamStats ? 'Heute erfasst' : 'Meine Stunden heute'}</span>
      <strong>{formatMinutes(displayMinutes)} <small>Std.</small></strong>
      {showTeamStats ? (
        <p><i /> Gesamtstunden aller Mitarbeitenden heute</p>
      ) : (
        <p><i /> Erfassung über „Zeit erfassen“ oben im Header</p>
      )}
      {rejectedCount > 0 && (
        <div className="infoboard-metric-alert callout callout-danger">
          <strong>
            {rejectedCount === 1
              ? '1 Zeiteintrag abgelehnt'
              : `${rejectedCount} Zeiteinträge abgelehnt`}
          </strong>
          <Link href="/app/zeiten#korrektur" className="text-button">
            Jetzt korrigieren
          </Link>
        </div>
      )}
    </article>
  );
}
