import { FileText } from 'lucide-react';

type Props = {
  openReports: number;
  pendingReports: number;
};

export function MetricReportsWidget({ openReports, pendingReports }: Props) {
  return (
    <article className="metric-card infoboard-metric-widget">
      <div className="metric-icon"><FileText size={20} /></div>
      <span>Offene Nachweise</span>
      <strong>{openReports}</strong>
      <p>{pendingReports} benötigen Freigabe</p>
    </article>
  );
}
