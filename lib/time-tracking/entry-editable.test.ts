import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isTimeEntryDeletable,
  isTimeEntryEditable,
  minEditableWorkDate,
} from './entry-editable';

describe('isTimeEntryEditable', () => {
  it('allows rejected completed entries', () => {
    assert.equal(
      isTimeEntryEditable({
        approval_status: 'rejected',
        work_date: '2026-06-01',
        end_time: '16:00:00',
      }),
      true,
    );
  });

  it('blocks approved entries', () => {
    assert.equal(
      isTimeEntryEditable({
        approval_status: 'approved',
        work_date: '2026-06-01',
        end_time: '16:00:00',
      }),
      false,
    );
  });

  it('blocks open entries without end_time', () => {
    assert.equal(
      isTimeEntryEditable({
        approval_status: 'pending',
        work_date: '2026-06-01',
        end_time: null,
      }),
      false,
    );
  });
});

describe('isTimeEntryDeletable', () => {
  it('respects editable date window', () => {
    const today = '2026-06-10';
    const min = minEditableWorkDate(today);
    assert.equal(
      isTimeEntryDeletable(
        { approval_status: 'pending', work_date: min, end_time: '16:00:00' },
        today,
      ),
      true,
    );
    assert.equal(
      isTimeEntryDeletable(
        { approval_status: 'pending', work_date: '2026-05-01', end_time: '16:00:00' },
        today,
      ),
      false,
    );
  });
});
