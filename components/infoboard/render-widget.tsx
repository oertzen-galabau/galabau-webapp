import type { InfoboardWidgetData, InfoboardWidgetId } from '@/lib/infoboard/types';
import { LeaveMineWidget } from '@/components/infoboard/widgets/leave-mine-widget';
import { LeavePendingWidget } from '@/components/infoboard/widgets/leave-pending-widget';
import { MetricCompletedWidget } from '@/components/infoboard/widgets/metric-completed-widget';
import { MetricHoursWidget } from '@/components/infoboard/widgets/metric-hours-widget';
import { MetricOpenSitesWidget } from '@/components/infoboard/widgets/metric-open-sites-widget';
import { MetricReportsWidget } from '@/components/infoboard/widgets/metric-reports-widget';
import { EquipmentUvvDueWidget } from '@/components/infoboard/widgets/equipment-uvv-due-widget';
import { PendingApprovalWidget } from '@/components/infoboard/widgets/pending-approval-widget';
import { ScheduleAssignmentsWidget } from '@/components/infoboard/widgets/schedule-assignments-widget';

type Props = {
  widgetId: InfoboardWidgetId;
  data: InfoboardWidgetData;
};

export function RenderWidget({ widgetId, data }: Props) {
  switch (widgetId) {
    case 'rejected_times':
      return null;
    case 'pending_approval':
      return (
        <PendingApprovalWidget
          rows={data.pendingApproval.rows}
          totalPending={data.pendingApproval.totalPending}
          emptyQuip={data.pendingApproval.emptyQuip}
        />
      );
    case 'metric_hours_today':
      return (
        <MetricHoursWidget
          totalMinutesToday={data.metrics.totalMinutesToday}
          showTeamStats={data.showTeamTimeStats}
          ownMinutesToday={data.ownMinutesToday}
          rejectedCount={data.rejectedCount}
        />
      );
    case 'metric_open_sites':
      return (
        <MetricOpenSitesWidget
          activeSites={data.metrics.activeSites}
          startingSitesThisWeek={data.metrics.startingSitesThisWeek}
        />
      );
    case 'metric_completed_month':
      return (
        <MetricCompletedWidget completedSitesThisMonth={data.metrics.completedSitesThisMonth} />
      );
    case 'metric_open_reports':
      return (
        <MetricReportsWidget
          openReports={data.metrics.openReports}
          pendingReports={data.metrics.pendingReports}
        />
      );
    case 'today_schedule':
      return null;
    case 'tomorrow_schedule':
      return (
        <ScheduleAssignmentsWidget
          title="Heute & Morgen"
          planDayIso={data.schedule.today.dayIso}
          sections={[
            {
              dayLabel: data.schedule.today.dateLabel,
              rows: data.schedule.today.rows,
              emptyMessage: 'Keine Einsätze für heute geplant.',
              planDayIso: data.schedule.today.dayIso,
            },
            {
              dayLabel: data.schedule.tomorrow.dateLabel,
              rows: data.schedule.tomorrow.rows,
              emptyMessage: 'Keine Einsätze für morgen geplant.',
              planDayIso: data.schedule.tomorrow.dayIso,
            },
          ]}
        />
      );
    case 'infoboard_posts':
      return null;
    case 'leave_pending':
      return (
        <LeavePendingWidget
          rows={data.leavePending.rows}
          totalPending={data.leavePending.totalPending}
        />
      );
    case 'leave_mine':
      return <LeaveMineWidget rows={data.leaveMine.rows} />;
    case 'messages_unread':
      return null;
    case 'site_weather':
      return <p className="muted infoboard-widget-empty">Wetter-Widget folgt in Kürze.</p>;
    case 'equipment_uvv_due':
      return (
        <EquipmentUvvDueWidget
          rows={data.equipmentUvvDue.rows}
          totalCount={data.equipmentUvvDue.totalCount}
        />
      );
    default:
      return null;
  }
}
