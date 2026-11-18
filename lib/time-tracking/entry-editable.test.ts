import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DUPLICATE_DAY_ERROR,
  isTimeEntryDeletable,
  isTimeEntryEditable,
  isWithinEditableDateRange,
  minEditableWorkDate,
  timeEntryWriteError,
} from './entry-editable';

describe('isWithinEditableDateRange', () => {
  it('allows today and up to 3 days back, never future', () => {
    const today = '2026-11-17';
    assert.equal(isWithinEditableDateRange('2026-11-17', today), true);
    assert.equal(isWithinEditableDateRange('2026-11-14', today), true);
    assert.equal(isWithinEditableDateRange('2026-11-13', today), false);
    assert.equal(isWithinEditableDateRange('2026-11-18', today), false);
  });
});

describe('timeEntryWriteError', () => {
  it('maps unique violations to the one-entry-per-day message', () => {
    assert.equal(timeEntryWriteError({ code: '23505', message: 'dup' }).message, DUPLICATE_DAY_ERROR);
    assert.equal(timeEntryWriteError({ code: '42501', message: 'rls' }).message, 'rls');
  });
});

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

  it('blocks submitted pending entries with end_time', () => {
    assert.equal(
      isTimeEntryEditable({
        approval_status: 'pending',
        work_date: '2026-06-01',
        end_time: '16:00:00',
      }),
      false,
    );
  });

  it('blocks completed entries without approval_status', () => {
    assert.equal(
      isTimeEntryEditable({
        approval_status: null,
        work_date: '2026-06-01',
        end_time: '16:00:00',
      }),
      false,
    );
  });
});

describe('isTimeEntryDeletable', () => {
  it('respects editable date window for open entries', () => {
    const today = '2026-06-10';
    const min = minEditableWorkDate(today);
    assert.equal(
      isTimeEntryDeletable(
        { approval_status: 'pending', work_date: min, end_time: null },
        today,
      ),
      true,
    );
    assert.equal(
      isTimeEntryDeletable(
        { approval_status: 'pending', work_date: '2026-05-01', end_time: null },
        today,
      ),
      false,
    );
  });

  it('blocks submitted pending entries even in date window', () => {
    const today = '2026-06-10';
    const min = minEditableWorkDate(today);
    assert.equal(
      isTimeEntryDeletable(
        { approval_status: 'pending', work_date: min, end_time: '16:00:00' },
        today,
      ),
      false,
    );
  });

  it('allows rejected entries in date window', () => {
    const today = '2026-06-10';
    const min = minEditableWorkDate(today);
    assert.equal(
      isTimeEntryDeletable(
        { approval_status: 'rejected', work_date: min, end_time: '16:00:00' },
        today,
      ),
      true,
    );
  });
});
