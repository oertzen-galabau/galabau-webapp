import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expandPermissions } from '@/lib/auth/permissions';

describe('infoboard.view_posts', () => {
  it('wird von Beiträgen veröffentlichen mitgezogen', () => {
    const perms = expandPermissions(['infoboard.posts']);
    assert.equal(perms.has('infoboard.view_posts'), true);
    assert.equal(perms.has('nav.infoboard'), true);
  });

  it('öffnet Navigation ohne Publish-Recht', () => {
    const perms = expandPermissions(['infoboard.view_posts']);
    assert.equal(perms.has('nav.infoboard'), true);
    assert.equal(perms.has('infoboard.posts'), false);
  });
});
