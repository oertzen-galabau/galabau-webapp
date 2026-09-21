import { BriefcaseBusiness } from 'lucide-react';

type Props = {
  activeSites: number;
  startingSitesThisWeek: number;
};

export function MetricOpenSitesWidget({ activeSites, startingSitesThisWeek }: Props) {
  return (
    <article className="metric-card infoboard-metric-widget">
      <div className="metric-icon"><BriefcaseBusiness size={20} /></div>
      <span>Offene Aufträge</span>
      <strong>{activeSites}</strong>
      <p><b>{startingSitesThisWeek}</b> starten diese Woche</p>
    </article>
  );
}
