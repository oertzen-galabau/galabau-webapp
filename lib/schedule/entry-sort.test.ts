import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reorderEntryIds } from '@/lib/schedule/entry-sort';

describe('reorderEntryIds', () => {
  it('verschiebt aktiven Eintrag auf Zielposition', () => {
    assert.deepEqual(reorderEntryIds(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
    assert.deepEqual(reorderEntryIds(['a', 'b', 'c'], 'a', 'c'), ['b', 'c', 'a']);
  });
});
