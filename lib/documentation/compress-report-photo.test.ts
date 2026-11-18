import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fitWithin } from './compress-report-photo';

describe('fitWithin', () => {
  it('skaliert Hochformat auf die längste Kante', () => {
    assert.deepEqual(fitWithin(3024, 4032), { width: 1440, height: 1920 });
  });

  it('skaliert Querformat auf die längste Kante', () => {
    assert.deepEqual(fitWithin(4000, 3000), { width: 1920, height: 1440 });
  });

  it('vergrößert kleine Bilder nicht', () => {
    assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
  });
});
