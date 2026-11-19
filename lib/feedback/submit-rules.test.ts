import assert from 'node:assert/strict';
import test from 'node:test';
import { FEEDBACK_BUG_DESCRIPTION_MIN_LENGTH, bugSubmitError } from '@/lib/feedback/submit-rules';

test('bugSubmitError rejects short description', () => {
  assert.match(bugSubmitError('kurz', 1) ?? '', /mindestens/);
});

test('bugSubmitError rejects missing screenshot', () => {
  assert.match(bugSubmitError('a'.repeat(FEEDBACK_BUG_DESCRIPTION_MIN_LENGTH), 0) ?? '', /Foto/);
});

test('bugSubmitError accepts valid bug payload', () => {
  assert.equal(bugSubmitError('a'.repeat(FEEDBACK_BUG_DESCRIPTION_MIN_LENGTH), 1), null);
});
