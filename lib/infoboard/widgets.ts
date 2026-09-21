import type { PermissionKey } from '@/lib/auth/permissions';
import type { InfoboardWidgetDef, InfoboardWidgetId } from '@/lib/infoboard/types';

export const INFOBOARD_GRID_COLS = 4;
export const INFOBOARD_MIN_W = 1;
export const INFOBOARD_MAX_W = INFOBOARD_GRID_COLS;
export const INFOBOARD_ROW_HEIGHT = 52;
const LEGACY_GRID_COLS = 12;

const GRID_WIDTH = { minW: INFOBOARD_MIN_W, maxW: INFOBOARD_MAX_W } as const;

export const WIDGET_REGISTRY: Record<InfoboardWidgetId, InfoboardWidgetDef> = {
  rejected_times: {
    id: 'rejected_times',
    label: 'Abgelehnte Zeiten',
    category: 'alert',
    permissions: ['nav.zeiten'],
    ...GRID_WIDTH,
    minH: 2,
    defaultW: 4,
    defaultH: 2,
    enabled: true,
  },
  pending_approval: {
    id: 'pending_approval',
    label: 'Zeiten zur Freigabe',
    category: 'panel',
    permissions: ['zeiten.approve'],
    ...GRID_WIDTH,
    minH: 3,
    defaultW: 4,
    defaultH: 4,
    enabled: true,
  },
  metric_hours_today: {
    id: 'metric_hours_today',
    label: 'Heute erfasst',
    category: 'metric',
    permissions: ['zeiten.view_all', 'zeiten.record'],
    permissionMode: 'any',
    ...GRID_WIDTH,
    minH: 3,
    defaultW: 2,
    defaultH: 3,
    enabled: true,
  },
  metric_open_sites: {
    id: 'metric_open_sites',
    label: 'Offene Aufträge',
    category: 'metric',
    permissions: ['sites.view'],
    ...GRID_WIDTH,
    minH: 3,
    defaultW: 1,
    defaultH: 3,
    enabled: true,
  },
  metric_completed_month: {
    id: 'metric_completed_month',
    label: 'Erledigt im Monat',
    category: 'metric',
    permissions: ['sites.view'],
    ...GRID_WIDTH,
    minH: 3,
    defaultW: 1,
    defaultH: 3,
    enabled: true,
  },
  metric_open_reports: {
    id: 'metric_open_reports',
    label: 'Offene Nachweise',
    category: 'metric',
    permissions: ['nav.rapporte'],
    ...GRID_WIDTH,
    minH: 3,
    defaultW: 2,
    defaultH: 3,
    enabled: true,
  },
  today_schedule: {
    id: 'today_schedule',
    label: 'Heutige Einsätze',
    category: 'panel',
    permissions: ['sites.view'],
    ...GRID_WIDTH,
    minH: 4,
    defaultW: 4,
    defaultH: 5,
    enabled: true,
  },
  infoboard_posts: {
    id: 'infoboard_posts',
    label: 'Beiträge',
    category: 'panel',
    permissions: ['infoboard.posts'],
    ...GRID_WIDTH,
    minH: 4,
    defaultW: 2,
    defaultH: 4,
    enabled: true,
  },
  leave_pending: {
    id: 'leave_pending',
    label: 'Offene Urlaubsanträge',
    category: 'metric',
    permissions: ['urlaub.approve'],
    ...GRID_WIDTH,
    minH: 3,
    defaultW: 2,
    defaultH: 3,
    enabled: true,
  },
  messages_unread: {
    id: 'messages_unread',
    label: 'Ungelesene Nachrichten',
    category: 'metric',
    permissions: ['nav.nachrichten'],
    ...GRID_WIDTH,
    minH: 3,
    defaultW: 2,
    defaultH: 3,
    enabled: true,
  },
  site_weather: {
    id: 'site_weather',
    label: 'Wetter heute',
    category: 'panel',
    permissions: ['sites.view'],
    ...GRID_WIDTH,
    minH: 3,
    defaultW: 2,
    defaultH: 3,
    enabled: false,
  },
};

export function widgetHasPermission(
  permissions: Set<PermissionKey>,
  widgetId: InfoboardWidgetId,
  isSuperadminBypass: boolean,
): boolean {
  const def = WIDGET_REGISTRY[widgetId];
  if (!def?.enabled) return false;
  if (isSuperadminBypass) return true;
  if (def.permissions.length === 0) return true;

  if (def.permissionMode === 'any') {
    return def.permissions.some((key) => permissions.has(key));
  }

  return def.permissions.every((key) => permissions.has(key));
}

export function allowedWidgetIds(
  permissions: Set<PermissionKey>,
  isSuperadminBypass: boolean,
): InfoboardWidgetId[] {
  return (Object.keys(WIDGET_REGISTRY) as InfoboardWidgetId[]).filter((id) =>
    widgetHasPermission(permissions, id, isSuperadminBypass),
  );
}

export function isLegacyGridLayout(items: { x: number; w: number }[]): boolean {
  return items.some((item) => item.x > INFOBOARD_GRID_COLS - 1 || item.w > INFOBOARD_GRID_COLS);
}

export function scaleLegacyLayoutItem<T extends { x: number; w: number }>(item: T): T {
  const scale = INFOBOARD_GRID_COLS / LEGACY_GRID_COLS;
  const w = Math.max(1, Math.min(INFOBOARD_GRID_COLS, Math.round(item.w * scale)));
  const x = Math.min(INFOBOARD_GRID_COLS - w, Math.max(0, Math.round(item.x * scale)));
  return { ...item, x, w };
}
