import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStructureSystemPrompt,
  buildWhisperVocabularyHint,
  matchSubcontractorPartner,
  normalizeDictationName,
} from '@/lib/ai/daily-log-dictation';

describe('daily log dictation prompts', () => {
  const hints = {
    employeeNames: ['Anna Müller', 'Max Schmidt'],
    subcontractorNames: ['Müller Garten GmbH'],
  };

  it('builds rapport prompt with field rules and name hints', () => {
    const prompt = buildStructureSystemPrompt('hourly_wage_rapport', hints);
    assert.match(prompt, /Std\.-Lohn-Rapport/);
    assert.match(prompt, /subcontractors/);
    assert.match(prompt, /Anna Müller/);
    assert.match(prompt, /Müller Garten GmbH/);
    assert.doesNotMatch(prompt, /Wetter.*extrahieren/i);
    assert.match(prompt, /Wetter.*ignorieren/i);
  });

  it('builds daily report prompt with empty worker/resource/subcontractor arrays', () => {
    const prompt = buildStructureSystemPrompt('daily_report', hints);
    assert.match(prompt, /Tagesbericht/);
    assert.match(prompt, /leere Arrays/);
    assert.doesNotMatch(prompt, /Std\.-Lohn-Rapport/);
  });

  it('includes names in whisper vocabulary hint', () => {
    const hint = buildWhisperVocabularyHint(hints);
    assert.match(hint, /GaLaBau/);
    assert.match(hint, /Anna Müller/);
    assert.match(hint, /Müller Garten GmbH/);
  });
});

describe('subcontractor partner matching', () => {
  const partners = [{ id: 'p1', name: 'Müller Garten GmbH' }];

  it('matches normalized company names', () => {
    const match = matchSubcontractorPartner('mueller garten', partners);
    assert.equal(match.partnerId, 'p1');
    assert.equal(match.confidence, 'high');
  });

  it('returns none for unrelated names', () => {
    const match = matchSubcontractorPartner('Unbekannt AG', partners);
    assert.equal(match.partnerId, null);
    assert.equal(match.confidence, 'none');
  });

  it('normalizes umlauts for comparison', () => {
    assert.equal(normalizeDictationName('Müller'), 'mueller');
    assert.equal(normalizeDictationName('Mueller'), 'mueller');
  });
});
