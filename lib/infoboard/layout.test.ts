import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PermissionKey } from '@/lib/auth/permissions';
import {
  DEFAULT_DASHBOARD_LAYOUT,
  isWidgetLocked,
  layoutForTabletDisplay,
  layoutsOverlap,
  resolveEffectiveLayout,
  setWidgetVisibility,
} from '@/lib/infoboard/layout';
import { INFOBOARD_GRID_COLS, INFOBOARD_TABLET_COLS } from '@/lib/infoboard/widgets';

const adminPermissions = new Set<PermissionKey>([
  'nav.infoboard',
  'nav.zeiten',
  'nav.rapporte',
  'sites.view',
  'zeiten.approve',
  'zeiten.view_all',
  'zeiten.record',
  'infoboard.posts',
  'urlaub.approve',
  'nav.nachrichten',
  'infoboard.customize',
]);

describe('resolveEffectiveLayout', () => {
  it('returns default layout items for permitted widgets', () => {
    const layout = resolveEffectiveLayout(null, adminPermissions, false);
    assert.equal(layout.version, 1);
    assert.ok(layout.items.some((item) => item.id === 'metric_hours_today'));
    assert.ok(layout.items.some((item) => item.id === 'pending_approval'));
    assert.ok(layout.items.some((item) => item.id === 'leave_pending'));
  });

  it('strips widgets without permission', () => {
    const employeePermissions = new Set<PermissionKey>([
      'nav.infoboard',
      'nav.zeiten',
      'zeiten.record',
      'urlaub.request',
      'infoboard.customize',
    ]);
    const layout = resolveEffectiveLayout(DEFAULT_DASHBOARD_LAYOUT, employeePermissions, false);
    assert.ok(!layout.items.some((item) => item.id === 'pending_approval'));
    assert.ok(!layout.items.some((item) => item.id === 'leave_pending'));
    assert.ok(layout.items.some((item) => item.id === 'leave_mine'));
    assert.ok(layout.items.some((item) => item.id === 'metric_hours_today'));
    assert.ok(layout.items.some((item) => item.id === 'infoboard_posts' && item.visible));
  });

  it('keeps locked widgets visible even when stored layout hides them', () => {
    const hiddenPosts = setWidgetVisibility(DEFAULT_DASHBOARD_LAYOUT, 'infoboard_posts', false);
    const layout = resolveEffectiveLayout(hiddenPosts, adminPermissions, false);
    const posts = layout.items.find((item) => item.id === 'infoboard_posts');
    assert.ok(posts?.visible);
  });

  it('prevents hiding locked widgets via setWidgetVisibility', () => {
    assert.equal(isWidgetLocked('infoboard_posts'), true);
    const hidden = setWidgetVisibility(DEFAULT_DASHBOARD_LAYOUT, 'infoboard_posts', false);
    const posts = hidden.items.find((item) => item.id === 'infoboard_posts');
    assert.equal(posts?.visible, true);
  });

  it('toggle visibility adds widget at next row', () => {
    const hidden = setWidgetVisibility(DEFAULT_DASHBOARD_LAYOUT, 'messages_unread', false);
    const shown = setWidgetVisibility(hidden, 'messages_unread', true);
    const item = shown.items.find((entry) => entry.id === 'messages_unread');
    assert.ok(item?.visible);
    assert.ok((item?.y ?? 0) >= 0);
  });

  it('uses a 4-column default layout without overlaps', () => {
    const layout = resolveEffectiveLayout(null, adminPermissions, false);
    const visible = layout.items.filter((item) => item.visible);
    assert.ok(visible.every((item) => item.x + item.w <= INFOBOARD_GRID_COLS));
    assert.equal(layoutsOverlap(visible), false);
  });

  it('migrates legacy 12-column stored layouts', () => {
    const legacy = {
      version: 1 as const,
      items: [
        { id: 'metric_hours_today' as const, x: 0, y: 0, w: 4, h: 3, visible: true },
        { id: 'today_schedule' as const, x: 0, y: 9, w: 8, h: 5, visible: true },
        { id: 'metric_open_sites' as const, x: 4, y: 6, w: 3, h: 3, visible: true },
      ],
    };
    const layout = resolveEffectiveLayout(legacy, adminPermissions, false);
    const schedule = layout.items.find((item) => item.id === 'today_schedule');
    assert.ok(schedule);
    assert.ok((schedule?.w ?? 0) <= INFOBOARD_GRID_COLS);
    const visible = layout.items.filter((item) => item.visible);
    assert.equal(layoutsOverlap(visible), false);
  });
});

describe('layoutForTabletDisplay', () => {
  it('stacks freigabe widgets full width and metrics two per row without overlap', () => {
    const sideBySideFreigabe: typeof DEFAULT_DASHBOARD_LAYOUT = {
      version: 1,
      items: DEFAULT_DASHBOARD_LAYOUT.items.map((item) => {
        if (item.id === 'pending_approval') return { ...item, x: 0, y: 0, w: 2, h: 4, visible: true };
        if (item.id === 'leave_pending') return { ...item, x: 2, y: 0, w: 2, h: 4, visible: true };
        return item;
      }),
    };

    const tablet = layoutForTabletDisplay(sideBySideFreigabe);
    const visible = tablet.items.filter((item) => item.visible);

    const pending = visible.find((item) => item.id === 'pending_approval');
    const leavePending = visible.find((item) => item.id === 'leave_pending');
    assert.equal(pending?.w, INFOBOARD_TABLET_COLS);
    assert.equal(pending?.x, 0);
    assert.equal(leavePending?.w, INFOBOARD_TABLET_COLS);
    assert.equal(leavePending?.x, 0);
    assert.ok((leavePending?.y ?? 0) > (pending?.y ?? 0));

    const metrics = visible.filter((item) => item.id.startsWith('metric_'));
    assert.ok(metrics.length > 0);
    assert.ok(metrics.every((item) => item.w === 1));
    assert.ok(visible.every((item) => item.x + item.w <= INFOBOARD_TABLET_COLS));
    assert.equal(layoutsOverlap(visible), false);
  });

  it('does not mutate the source layout', () => {
    const source = structuredClone(DEFAULT_DASHBOARD_LAYOUT);
    layoutForTabletDisplay(source);
    const pendingBefore = DEFAULT_DASHBOARD_LAYOUT.items.find((item) => item.id === 'pending_approval');
    const pendingSource = source.items.find((item) => item.id === 'pending_approval');
    assert.deepEqual(pendingSource, pendingBefore);
  });
});
