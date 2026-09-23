import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getMemberAccessStatus,
  memberAccessStatusBadgeClass,
  memberAccessStatusLabel,
} from './member-access-status';

describe('member-access-status', () => {
  it('prioritizes inactive over invited', () => {
    assert.equal(
      getMemberAccessStatus({ is_active: false, must_change_password: true }),
      'inactive',
    );
  });

  it('marks pending first login as invited', () => {
    assert.equal(
      getMemberAccessStatus({ is_active: true, must_change_password: true }),
      'invited',
    );
    assert.equal(memberAccessStatusLabel('invited'), 'Eingeladen');
    assert.equal(memberAccessStatusBadgeClass('invited'), 'invited');
  });

  it('marks completed onboarding as active', () => {
    assert.equal(
      getMemberAccessStatus({ is_active: true, must_change_password: false }),
      'active',
    );
  });
});
