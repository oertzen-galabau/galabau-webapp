import {
  type DailyLogReportType,
  displayTitleForLog,
  shortLabelForReportType,
} from '@/lib/documentation/report-labels';

type Props = {
  reportType: DailyLogReportType;
  customTitle?: string | null;
  showFullTitle?: boolean;
};

export function DailyLogReportTypeBadge({ reportType, customTitle, showFullTitle = false }: Props) {
  const short = shortLabelForReportType(reportType);
  const full = displayTitleForLog(reportType, customTitle);
  const titleAttr = full !== short ? full : undefined;

  return (
    <span className="status-badge travel documentation-report-type-badge" title={titleAttr}>
      {showFullTitle && customTitle?.trim() ? full : short}
    </span>
  );
}
