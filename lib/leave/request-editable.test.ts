import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canEditLeaveRequest } from '@/lib/leave/request-editable';

describe('canEditLeaveRequest', () => {
  it('erlaubt Mitarbeitern nur offene oder abgelehnte Anträge', () => {
    assert.equal(canEditLeaveRequest({ status: 'pending' }, { isOwner: true, canApprove: false }), true);
    assert.equal(canEditLeaveRequest({ status: 'rejected' }, { isOwner: true, canApprove: false }), true);
    assert.equal(canEditLeaveRequest({ status: 'approved' }, { isOwner: true, canApprove: false }), false);
  });

  it('erlaubt Genehmigern offene und genehmigte Anträge', () => {
    assert.equal(canEditLeaveRequest({ status: 'pending' }, { isOwner: false, canApprove: true }), true);
    assert.equal(canEditLeaveRequest({ status: 'approved' }, { isOwner: false, canApprove: true }), true);
    assert.equal(canEditLeaveRequest({ status: 'rejected' }, { isOwner: false, canApprove: true }), false);
  });
});
