import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCUMENTS_TAB_KINDS,
  DOCUMENTS_PAGE_PATH,
  buildDocumentsPageHref,
  filterItemsByKinds,
  kindsForDocumentsTab,
  parseDocumentsArtFilter,
  parseDocumentsTab,
  parseReportArtFilter,
  kindsForTabWithArt,
  tabNeedsDeliveryNotes,
  tabNeedsPdfReports,
  tabNeedsReportPhotos,
  tabNeedsSiteDocuments,
} from '@/lib/documentation/documents-tabs';
import type { DocumentationOverviewItem } from '@/lib/documentation/documentation-overview-types';

describe('documents tabs', () => {
  it('falls back to dokumente for invalid tab param', () => {
    assert.equal(parseDocumentsTab(undefined), 'dokumente');
    assert.equal(parseDocumentsTab(''), 'dokumente');
    assert.equal(parseDocumentsTab('invalid'), 'dokumente');
    assert.equal(parseDocumentsTab('fotos'), 'fotos');
  });

  it('maps tabs to overview kinds', () => {
    assert.deepEqual(kindsForDocumentsTab('dokumente'), DOCUMENTS_TAB_KINDS.dokumente);
    assert.deepEqual(kindsForDocumentsTab('rapporte'), ['pdf_report']);
    assert.deepEqual(kindsForDocumentsTab('lieferscheine'), ['delivery_note']);
  });

  it('detects which loaders a tab needs', () => {
    const docKinds = kindsForDocumentsTab('dokumente');
    assert.equal(tabNeedsSiteDocuments(docKinds), true);
    assert.equal(tabNeedsPdfReports(docKinds), false);

    const photoKinds = kindsForDocumentsTab('fotos');
    assert.equal(tabNeedsReportPhotos(photoKinds), true);
    assert.equal(tabNeedsDeliveryNotes(photoKinds), false);
  });

  it('builds hrefs preserving site filter', () => {
    assert.equal(buildDocumentsPageHref('dokumente'), DOCUMENTS_PAGE_PATH);
    assert.equal(buildDocumentsPageHref('dokumente', 'site-1'), `${DOCUMENTS_PAGE_PATH}?site=site-1`);
    assert.equal(
      buildDocumentsPageHref('fotos', 'site-1'),
      `${DOCUMENTS_PAGE_PATH}?tab=fotos&site=site-1`,
    );
    assert.equal(
      buildDocumentsPageHref('dokumente', 'site-1', 'plan'),
      `${DOCUMENTS_PAGE_PATH}?site=site-1&art=plan`,
    );
  });

  it('parses art filter only on dokumente tab', () => {
    assert.equal(parseDocumentsArtFilter('plan', 'dokumente'), 'plan');
    assert.equal(parseDocumentsArtFilter('plan', 'fotos'), null);
    assert.equal(parseDocumentsArtFilter('invalid', 'dokumente'), null);
  });

  it('parses report art filter only on rapporte tab', () => {
    assert.equal(parseReportArtFilter('daily_report', 'rapporte'), 'daily_report');
    assert.equal(parseReportArtFilter('daily_report', 'dokumente'), null);
    assert.equal(
      buildDocumentsPageHref('rapporte', null, 'hourly_wage_rapport'),
      `${DOCUMENTS_PAGE_PATH}?tab=rapporte&art=hourly_wage_rapport`,
    );
  });

  it('narrows kinds when art filter is set', () => {
    assert.deepEqual(kindsForTabWithArt('dokumente', 'plan'), ['site_plan']);
    assert.deepEqual(kindsForTabWithArt('dokumente', null), kindsForDocumentsTab('dokumente'));
  });

  it('filters items by kind', () => {
    const items: DocumentationOverviewItem[] = [
      {
        id: '1',
        kind: 'site_plan',
        sortDate: '2026-01-01',
        siteId: 's',
        siteName: 'A',
        title: 'Plan',
      },
      {
        id: '2',
        kind: 'pdf_report',
        sortDate: '2026-01-02',
        siteId: 's',
        siteName: 'A',
        title: 'R',
      },
    ];
    const filtered = filterItemsByKinds(items, kindsForDocumentsTab('dokumente'));
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.kind, 'site_plan');
  });
});
