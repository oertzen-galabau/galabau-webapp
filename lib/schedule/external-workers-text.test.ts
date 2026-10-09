import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildExternalWorkersText, parseExternalWorkersText } from '@/lib/schedule/external-workers-text';

const subs = [
  { id: 'a', name: 'Beispiel GmbH' },
  { id: 'b', name: 'Muster & Co.' },
];

describe('parseExternalWorkersText', () => {
  it('erkennt Stammlisten-Namen und Zusatz mit Anzahl', () => {
    const r = parseExternalWorkersText('Beispiel GmbH +2, Muster & Co.', subs);
    assert.deepEqual(r.selectedPartnerIds, ['a', 'b']);
    assert.equal(r.extra, 'Beispiel GmbH +2');
  });

  it('lässt unbekannte Segmente im Zusatz', () => {
    const r = parseExternalWorkersText('Fremdfirma, Beispiel GmbH', subs);
    assert.deepEqual(r.selectedPartnerIds, ['a']);
    assert.equal(r.extra, 'Fremdfirma');
  });
});

describe('buildExternalWorkersText', () => {
  it('baut kommagetrennten Text', () => {
    assert.equal(buildExternalWorkersText(['a', 'b'], subs, ''), 'Beispiel GmbH, Muster & Co.');
    assert.equal(buildExternalWorkersText(['a'], subs, 'weitere Info'), 'Beispiel GmbH, weitere Info');
  });

  it('übernimmt Anzahl aus dem Zusatz ohne Duplikat', () => {
    assert.equal(
      buildExternalWorkersText(['a', 'b'], subs, 'Beispiel GmbH +2'),
      'Beispiel GmbH +2, Muster & Co.',
    );
  });
});
