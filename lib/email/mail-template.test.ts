import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTransactionalMailHtml, escapeHtml, mailCtaButtonHtml, mailSecretHighlightHtml } from '@/lib/email/mail-template';

test('escapeHtml escapes special characters', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml('"x"'), '&quot;x&quot;');
});

test('buildTransactionalMailHtml does not allow raw HTML in lead', () => {
  const html = buildTransactionalMailHtml({
    platformName: 'Test <Co>',
    title: 'Hello',
    leadParagraph: 'Hi <b>there</b>',
  });
  assert.match(html, /Test &lt;Co&gt;/);
  assert.match(html, /Hi &lt;b&gt;there&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>there<\/b>/);
});

test('mailCtaButtonHtml escapes href and label', () => {
  const frag = mailCtaButtonHtml('https://x.com/a"b', 'Click "me"');
  assert.match(frag, /href="https:\/\/x\.com\/a&quot;b"/);
  assert.match(frag, /Click &quot;me&quot;/);
});

test('mailSecretHighlightHtml escapes value', () => {
  const frag = mailSecretHighlightHtml('Code', '<123>');
  assert.match(frag, /&lt;123&gt;/);
});
