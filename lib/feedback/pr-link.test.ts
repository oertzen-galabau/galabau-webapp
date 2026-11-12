import assert from 'node:assert/strict';
import test from 'node:test';
import { extractGithubPullRequestUrl } from '@/lib/feedback/pr-link';
import { extractFeedbackReportIdFromPrText } from '@/lib/feedback/github-pr-webhook';

test('extractGithubPullRequestUrl from note line', () => {
  const url = 'https://github.com/oertzen-galabau/galabau-webapp/pull/42';
  const note = `[01.01.2026] KI-Agent gestartet\n[01.01.2026] PR: ${url}`;
  assert.equal(extractGithubPullRequestUrl(note), url);
});

test('extractFeedbackReportIdFromPrText from title', () => {
  const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  assert.equal(
    extractFeedbackReportIdFromPrText(`Fix: Login (${id})`),
    id.toLowerCase(),
  );
});
