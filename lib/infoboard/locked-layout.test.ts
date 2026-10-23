import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { layoutForTabletDisplay, resolveEffectiveLayout } from '@/lib/infoboard/layout';
import { INFOBOARD_GRID_COLS, INFOBOARD_TABLET_COLS } from '@/lib/infoboard/widgets';
import type { PermissionKey } from '@/lib/auth/permissions';

const adminPermissions = new Set<PermissionKey>([
  'nav.infoboard',
  'sites.view',
  'infoboard.posts',
  'infoboard.customize',
]);

describe('layoutForTabletDisplay locked schedule', () => {
  it('Heute & Morgen volle Breite oben', () => {
    const layout = resolveEffectiveLayout(null, adminPermissions, false);
    const tablet = layoutForTabletDisplay(layout);
    const schedule = tablet.items.find((item) => item.id === 'tomorrow_schedule');
    assert.equal(schedule?.y, 0);
    assert.equal(schedule?.x, 0);
    assert.equal(schedule?.w, INFOBOARD_TABLET_COLS);
    assert.ok(!tablet.items.some((item) => item.id === 'infoboard_posts' && item.visible));
  });
});

describe('resolveEffectiveLayout schedule width', () => {
  it('Heute & Morgen nutzt volle Desktop-Breite', () => {
    const layout = resolveEffectiveLayout(null, adminPermissions, false);
    const schedule = layout.items.find((item) => item.id === 'tomorrow_schedule');
    assert.equal(schedule?.w, INFOBOARD_GRID_COLS);
    assert.equal(schedule?.x, 0);
  });
});
