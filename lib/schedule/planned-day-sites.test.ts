import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('planned-day-sites module', () => {
  it('exports getPlannedDaySitesForUser', async () => {
    const mod = await import('@/lib/schedule/planned-day-sites');
    assert.equal(typeof mod.getPlannedDaySitesForUser, 'function');
  });
});
