import { verticalCompactor, type Layout } from 'react-grid-layout';
import type { PermissionKey } from '@/lib/auth/permissions';
import type { DashboardLayout, DashboardLayoutItem, InfoboardWidgetId } from '@/lib/infoboard/types';
import { clampLayoutItem, clampStoredLayoutItem, storedDashboardLayoutSchema } from '@/lib/infoboard/schema';
import {
  allowedWidgetIds,
  INFOBOARD_GRID_COLS,
  INFOBOARD_MAX_W,
  INFOBOARD_MIN_W,
  INFOBOARD_TABLET_COLS,
  isLegacyGridLayout,
  scaleLegacyLayoutItem,
  WIDGET_REGISTRY,
} from '@/lib/infoboard/widgets';

const TABLET_FREIGABE_WIDGETS = new Set<InfoboardWidgetId>(['pending_approval', 'leave_pending']);

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  version: 1,
  items: [
    { id: 'pending_approval', x: 0, y: 0, w: 4, h: 4, visible: true },
    { id: 'leave_pending', x: 0, y: 4, w: 4, h: 4, visible: true },
    { id: 'leave_mine', x: 0, y: 8, w: 4, h: 4, visible: true },
    { id: 'metric_hours_today', x: 0, y: 12, w: 2, h: 3, visible: true },
    { id: 'metric_open_sites', x: 2, y: 12, w: 1, h: 3, visible: true },
    { id: 'metric_completed_month', x: 3, y: 12, w: 1, h: 3, visible: true },
    { id: 'metric_open_reports', x: 0, y: 15, w: 2, h: 3, visible: true },
    { id: 'today_schedule', x: 0, y: 18, w: 4, h: 5, visible: true },
    { id: 'infoboard_posts', x: 0, y: 23, w: 2, h: 4, visible: true },
    { id: 'messages_unread', x: 2, y: 23, w: 2, h: 3, visible: true },
  ],
};

function defaultItemFor(id: InfoboardWidgetId, y: number): DashboardLayoutItem {
  const def = WIDGET_REGISTRY[id];
  return {
    id,
    x: 0,
    y,
    w: def.defaultW,
    h: def.defaultH,
    visible: false,
  };
}

function toGridItems(items: DashboardLayoutItem[], cols: number = INFOBOARD_GRID_COLS): Layout {
  const maxW = Math.min(INFOBOARD_MAX_W, cols);
  return items
    .filter((item) => item.visible)
    .map((item) => {
      const def = WIDGET_REGISTRY[item.id];
      return {
        i: item.id,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: INFOBOARD_MIN_W,
        minH: def.minH,
        maxW,
        maxH: def.maxH,
      };
    });
}

export function compactDashboardLayout(
  layout: DashboardLayout,
  cols: number = INFOBOARD_GRID_COLS,
): DashboardLayout {
  const gridItems = toGridItems(layout.items, cols);
  if (gridItems.length === 0) return layout;

  const compacted = verticalCompactor.compact([...gridItems], cols);
  return mergeGridLayoutChange(
    layout,
    compacted.map((item) => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    })),
  );
}

function migrateLegacyItems(items: DashboardLayoutItem[]): DashboardLayoutItem[] {
  if (!isLegacyGridLayout(items)) return items;
  return items.map((item) => clampLayoutItem(scaleLegacyLayoutItem(item)));
}

export function parseStoredLayout(raw: unknown): DashboardLayout | null {
  const parsed = storedDashboardLayoutSchema.safeParse(raw);
  if (!parsed.success) return null;
  const items = migrateLegacyItems(parsed.data.items.map(clampStoredLayoutItem)).map(clampLayoutItem);
  return compactDashboardLayout({ version: 1, items });
}

export function resolveEffectiveLayout(
  stored: unknown,
  permissions: Set<PermissionKey>,
  isSuperadminBypass: boolean,
): DashboardLayout {
  const permitted = new Set(allowedWidgetIds(permissions, isSuperadminBypass));
  const base = parseStoredLayout(stored) ?? DEFAULT_DASHBOARD_LAYOUT;

  const merged = new Map<InfoboardWidgetId, DashboardLayoutItem>();
  for (const item of base.items) {
    if (permitted.has(item.id)) {
      merged.set(item.id, clampLayoutItem(item));
    }
  }

  let nextY = 0;
  for (const item of merged.values()) {
    nextY = Math.max(nextY, item.y + item.h);
  }

  for (const id of permitted) {
    if (!merged.has(id)) {
      merged.set(id, defaultItemFor(id, nextY));
      nextY += WIDGET_REGISTRY[id].defaultH;
    }
  }

  const items = [...merged.values()]
    .filter((item) => permitted.has(item.id))
    .map((item) => {
      if (WIDGET_REGISTRY[item.id]?.locked) {
        return { ...item, visible: true };
      }
      return item;
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);

  return compactDashboardLayout({ version: 1, items });
}

export function visibleLayoutItems(layout: DashboardLayout): DashboardLayoutItem[] {
  return layout.items.filter((item) => item.visible);
}

export function findNextPosition(
  layout: DashboardLayout,
  widgetId: InfoboardWidgetId,
): Pick<DashboardLayoutItem, 'x' | 'y' | 'w' | 'h'> {
  const def = WIDGET_REGISTRY[widgetId];
  const visible = visibleLayoutItems(layout);
  const maxY = visible.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  return { x: 0, y: maxY, w: def.defaultW, h: def.defaultH };
}

export function layoutToGridLayout(
  items: DashboardLayoutItem[],
  cols: number = INFOBOARD_GRID_COLS,
) {
  return toGridItems(items, cols);
}

function scaleItemToTabletCols(item: DashboardLayoutItem): DashboardLayoutItem {
  if (!item.visible) return item;

  const def = WIDGET_REGISTRY[item.id];
  const cols = INFOBOARD_TABLET_COLS;

  if (TABLET_FREIGABE_WIDGETS.has(item.id)) {
    return { ...item, w: cols, x: 0 };
  }

  if (def.category === 'metric') {
    return { ...item, w: 1, x: 0 };
  }

  const w = Math.max(1, Math.min(cols, Math.round(item.w / 2)));
  const x = Math.min(cols - w, Math.max(0, Math.round(item.x / 2)));
  return { ...item, w, x };
}

/** Nur für die Tablet-Anzeige — gespeichertes Layout bleibt unverändert. */
export function layoutForTabletDisplay(layout: DashboardLayout): DashboardLayout {
  const items = layout.items.map(scaleItemToTabletCols);
  return compactDashboardLayout({ version: 1, items }, INFOBOARD_TABLET_COLS);
}

export function mergeGridLayoutChange(
  layout: DashboardLayout,
  gridItems: { i: string; x: number; y: number; w: number; h: number }[],
): DashboardLayout {
  const byId = new Map(gridItems.map((item) => [item.i as InfoboardWidgetId, item]));
  return {
    version: 1,
    items: layout.items.map((item) => {
      const updated = byId.get(item.id);
      if (!updated || !item.visible) return item;
      return clampLayoutItem({
        ...item,
        x: updated.x,
        y: updated.y,
        w: updated.w,
        h: updated.h,
      });
    }),
  };
}

export function isWidgetLocked(widgetId: InfoboardWidgetId): boolean {
  return WIDGET_REGISTRY[widgetId]?.locked === true;
}

export function setWidgetVisibility(
  layout: DashboardLayout,
  widgetId: InfoboardWidgetId,
  visible: boolean,
): DashboardLayout {
  if (!visible && isWidgetLocked(widgetId)) return layout;

  const existing = layout.items.find((item) => item.id === widgetId);
  if (!existing) return layout;

  let nextLayout: DashboardLayout;
  if (visible) {
    const position = existing.visible
      ? { x: existing.x, y: existing.y, w: existing.w, h: existing.h }
      : findNextPosition(layout, widgetId);
    nextLayout = {
      version: 1,
      items: layout.items.map((item) =>
        item.id === widgetId ? { ...item, ...position, visible: true } : item,
      ),
    };
  } else {
    nextLayout = {
      version: 1,
      items: layout.items.map((item) =>
        item.id === widgetId ? { ...item, visible: false } : item,
      ),
    };
  }

  return compactDashboardLayout(nextLayout);
}

export function layoutsOverlap(items: DashboardLayoutItem[]): boolean {
  const visible = items.filter((item) => item.visible);
  for (let i = 0; i < visible.length; i += 1) {
    const a = visible[i];
    for (let j = i + 1; j < visible.length; j += 1) {
      const b = visible[j];
      const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
      const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
      if (overlapX && overlapY) return true;
    }
  }
  return false;
}
