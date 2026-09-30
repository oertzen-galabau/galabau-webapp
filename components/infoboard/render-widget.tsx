import type { InfoboardWidgetData, InfoboardWidgetId } from '@/lib/infoboard/types';
import { InfoboardPostsWidget } from '@/components/infoboard/widgets/infoboard-posts-widget';
import { LeavePendingWidget } from '@/components/infoboard/widgets/leave-pending-widget';
import { MessagesUnreadWidget } from '@/components/infoboard/widgets/messages-unread-widget';
import { MetricCompletedWidget } from '@/components/infoboard/widgets/metric-completed-widget';
import { MetricHoursWidget } from '@/components/infoboard/widgets/metric-hours-widget';
import { MetricOpenSitesWidget } from '@/components/infoboard/widgets/metric-open-sites-widget';
import { MetricReportsWidget } from '@/components/infoboard/widgets/metric-reports-widget';
import { PendingApprovalWidget } from '@/components/infoboard/widgets/pending-approval-widget';
import { RejectedTimesWidget } from '@/components/infoboard/widgets/rejected-times-widget';
import { TodayScheduleWidget } from '@/components/infoboard/widgets/today-schedule-widget';

type Props = {
  widgetId: InfoboardWidgetId;
  data: InfoboardWidgetData;
};

export function RenderWidget({ widgetId, data }: Props) {
  switch (widgetId) {
    case 'rejected_times':
      return <RejectedTimesWidget rejectedCount={data.rejectedCount} />;
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
          activeWorkers={data.metrics.activeWorkers}
          totalWorkers={data.metrics.totalWorkers}
          showTeamStats={data.showTeamTimeStats}
          ownMinutesToday={data.ownMinutesToday}
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
      return <TodayScheduleWidget dateLabel={data.dateLabel} rows={data.schedule.rows} />;
    case 'infoboard_posts':
      return (
        <InfoboardPostsWidget posts={data.posts} canManagePosts={data.canManagePosts} />
      );
    case 'leave_pending':
      return <LeavePendingWidget count={data.leavePendingCount} />;
    case 'messages_unread':
      return <MessagesUnreadWidget count={data.unreadMessagesCount} />;
    case 'site_weather':
      return <p className="muted infoboard-widget-empty">Wetter-Widget folgt in Kürze.</p>;
    default:
      return null;
  }
}
