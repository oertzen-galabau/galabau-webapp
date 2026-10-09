import {
  type DailyLogReportType,
  displayTitleForLog,
  shortLabelForReportType,
  type TenantReportLabelConfig,
} from '@/lib/documentation/report-labels';

type Props = {
  reportType: DailyLogReportType;
  customTitle?: string | null;
  showFullTitle?: boolean;
  reportLabels?: TenantReportLabelConfig;
};

export function DailyLogReportTypeBadge({
  reportType,
  customTitle,
  showFullTitle = false,
  reportLabels,
}: Props) {
  const short = shortLabelForReportType(reportType, reportLabels);
  const full = displayTitleForLog(reportType, customTitle, reportLabels);
  const titleAttr = full !== short ? full : undefined;

  return (
    <span className="status-badge travel documentation-report-type-badge" title={titleAttr}>
      {showFullTitle && customTitle?.trim() ? full : short}
    </span>
  );
}
