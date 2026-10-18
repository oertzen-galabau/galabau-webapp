import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  kindLabel,
  mergeAndSortOverviewItems,
  siteDocumentKind,
  type DocumentationOverviewItem,
} from '@/lib/documentation/documentation-overview-types';

describe('documentation overview', () => {
  it('maps site document categories', () => {
    assert.equal(siteDocumentKind('plan'), 'site_plan');
    assert.equal(siteDocumentKind('leistungsverzeichnis'), 'site_lv');
    assert.equal(siteDocumentKind(null), 'site_other');
  });

  it('sorts by date descending then title', () => {
    const items: DocumentationOverviewItem[] = [
      {
        id: 'a',
        kind: 'site_plan',
        sortDate: '2026-01-01',
        siteId: '1',
        siteName: 'A',
        title: 'Z Plan',
      },
      {
        id: 'b',
        kind: 'pdf_report',
        sortDate: '2026-02-01',
        siteId: '1',
        siteName: 'A',
        title: 'Rapport',
      },
      {
        id: 'c',
        kind: 'site_other',
        sortDate: '2026-01-01',
        siteId: '1',
        siteName: 'A',
        title: 'A Doc',
      },
    ];
    const merged = mergeAndSortOverviewItems(items, 10);
    assert.deepEqual(
      merged.map((i) => i.id),
      ['b', 'c', 'a'],
    );
  });

  it('labels kinds for display', () => {
    assert.equal(kindLabel('pdf_report'), 'PDF-Rapport');
    assert.equal(kindLabel('delivery_note'), 'Lieferschein');
  });
});
