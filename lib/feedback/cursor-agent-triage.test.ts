import assert from 'node:assert/strict';
import test from 'node:test';
import { triageCursorAgentTrigger } from '@/lib/feedback/cursor-agent-triage';

const base = {
  kind: 'bug' as const,
  title: 'Speichern klappt nicht',
  description: 'A'.repeat(40),
  webhookConfigured: true,
  startsToday: 0,
  dailyLimit: 5,
  minDescriptionLength: 40,
};

test('triage allows qualified bug', () => {
  assert.deepEqual(triageCursorAgentTrigger(base), { ok: true });
});

test('triage rejects feedback', () => {
  const r = triageCursorAgentTrigger({ ...base, kind: 'feedback' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'not_bug');
});

test('triage rejects short description', () => {
  const r = triageCursorAgentTrigger({ ...base, description: 'kurz' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'description_too_short');
});

test('triage rejects missing webhook config', () => {
  const r = triageCursorAgentTrigger({ ...base, webhookConfigured: false });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'webhook_not_configured');
});

test('triage rejects daily limit', () => {
  const r = triageCursorAgentTrigger({ ...base, startsToday: 5 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'daily_limit');
});
