import { CheckCircle2 } from 'lucide-react';

type Props = {
  completedSitesThisMonth: number;
};

export function MetricCompletedWidget({ completedSitesThisMonth }: Props) {
  return (
    <article className="metric-card infoboard-metric-widget">
      <div className="metric-icon"><CheckCircle2 size={20} /></div>
      <span>Erledigt im Monat</span>
      <strong>{completedSitesThisMonth}</strong>
      <p>Abgeschlossene Baustellen</p>
    </article>
  );
}
