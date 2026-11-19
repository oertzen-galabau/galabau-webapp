import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldNotifyFeedbackOwnerOnDone } from '@/lib/email/feedback-notification';

test('shouldNotifyFeedbackOwnerOnDone only on transition into done', () => {
  assert.equal(shouldNotifyFeedbackOwnerOnDone('open', 'done'), true);
  assert.equal(shouldNotifyFeedbackOwnerOnDone('in_progress', 'done'), true);
  assert.equal(shouldNotifyFeedbackOwnerOnDone('done', 'done'), false);
  assert.equal(shouldNotifyFeedbackOwnerOnDone('done', 'open'), false);
  assert.equal(shouldNotifyFeedbackOwnerOnDone('open', 'in_progress'), false);
});
