import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { teamVisibleTimeEntryQuery } from './employee-detail-data';

describe('teamVisibleTimeEntryQuery', () => {
  it('filters to approved in admin mode', () => {
    const calls: string[] = [];
    const query = {
      eq(col: string, val: string) {
        calls.push(`${col}=${val}`);
        return this;
      },
    };
    teamVisibleTimeEntryQuery(query, 'admin');
    assert.deepEqual(calls, ['approval_status=approved']);
  });

  it('leaves query unchanged in self mode', () => {
    const calls: string[] = [];
    const query = {
      eq(col: string, val: string) {
        calls.push(`${col}=${val}`);
        return this;
      },
    };
    teamVisibleTimeEntryQuery(query, 'self');
    assert.deepEqual(calls, []);
  });
});