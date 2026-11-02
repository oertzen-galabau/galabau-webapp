import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SITE_DOCUMENT_CATEGORY,
  SITE_DOCUMENT_CATEGORY_OPTIONS,
  isSiteDocumentCategory,
  parseSiteDocumentCategory,
} from '@/lib/sites/document-categories';

describe('site document categories', () => {
  it('includes Fotos in the upload options', () => {
    assert.deepEqual(
      SITE_DOCUMENT_CATEGORY_OPTIONS.map((option) => option.value),
      ['plan', 'leistungsverzeichnis', 'fotos', 'sonstiges'],
    );
    assert.equal(
      SITE_DOCUMENT_CATEGORY_OPTIONS.find((option) => option.value === 'fotos')?.label,
      'Fotos',
    );
  });

  it('parses known categories and falls back to Sonstiges', () => {
    assert.equal(isSiteDocumentCategory('fotos'), true);
    assert.equal(isSiteDocumentCategory('unknown'), false);
    assert.equal(parseSiteDocumentCategory('fotos'), 'fotos');
    assert.equal(parseSiteDocumentCategory(null), DEFAULT_SITE_DOCUMENT_CATEGORY);
    assert.equal(parseSiteDocumentCategory('nope'), 'sonstiges');
  });
});
