import type { PermissionKey } from '@/lib/auth/permissions';

export const INFOBOARD_WIDGET_IDS = [
  'rejected_times',
  'pending_approval',
  'metric_hours_today',
  'metric_open_sites',
  'metric_completed_month',
  'metric_open_reports',
  'today_schedule',
  'infoboard_posts',
  'leave_pending',
  'messages_unread',
  'site_weather',
] as const;

export type InfoboardWidgetId = (typeof INFOBOARD_WIDGET_IDS)[number];

export type InfoboardWidgetCategory = 'alert' | 'metric' | 'panel';

export type InfoboardWidgetDef = {
  id: InfoboardWidgetId;
  label: string;
  category: InfoboardWidgetCategory;
  permissions: PermissionKey[];
  permissionMode?: 'any' | 'all';
  minW: number;
  minH: number;
  defaultW: number;
  defaultH: number;
  maxW?: number;
  maxH?: number;
  enabled: boolean;
};

export type DashboardLayoutItem = {
  id: InfoboardWidgetId;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
};

export type DashboardLayout = {
  version: 1;
  items: DashboardLayoutItem[];
};

export type ScheduleRow = {
  id: string;
  time: string;
  title: string;
  place: string;
  tone: 'active' | 'travel' | 'planned';
  href: string;
};

export type PendingApprovalRow = {
  id: string;
  workDate: string;
  workMinutes: number;
  name: string;
};

export type InfoboardPostRow = {
  id: string;
  title: string;
  content: string;
  postType: string;
  publishedAt: string | null;
  createdAt: string;
};

export type InfoboardWidgetData = {
  greeting: string;
  firstName: string;
  dateLabel: string;
  subtitle: string;
  rejectedCount: number;
  pendingApproval: {
    rows: PendingApprovalRow[];
    totalPending: number;
    emptyQuip: string;
  };
  metrics: {
    totalMinutesToday: number;
    activeWorkers: number;
    totalWorkers: number;
    activeSites: number;
    startingSitesThisWeek: number;
    completedSitesThisMonth: number;
    openReports: number;
    pendingReports: number;
  };
  schedule: {
    rows: ScheduleRow[];
  };
  posts: InfoboardPostRow[];
  leavePendingCount: number;
  unreadMessagesCount: number;
};
