import type { DocumentationOverviewKind } from '@/lib/documentation/documentation-overview-types';
import {
  isDailyLogReportType,
  type DailyLogReportType,
} from '@/lib/documentation/report-labels';

export const DOCUMENTS_PAGE_PATH = '/app/dokumente';

export const DOCUMENTS_TABS = [
  { id: 'dokumente', label: 'Dokumente' },
  { id: 'rapporte', label: 'Tagesberichte/Rapporte' },
  { id: 'fotos', label: 'Fotos' },
  { id: 'lieferscheine', label: 'Lieferscheine' },
] as const;

export type DocumentsTabId = (typeof DOCUMENTS_TABS)[number]['id'];

export const DOCUMENTS_TAB_KINDS: Record<
  DocumentsTabId,
  readonly DocumentationOverviewKind[]
> = {
  dokumente: ['site_plan', 'site_lv', 'site_other'],
  rapporte: ['pdf_report'],
  fotos: ['report_photo'],
  lieferscheine: ['delivery_note'],
};

export function isDocumentsTab(value: string | undefined): value is DocumentsTabId {
  return DOCUMENTS_TABS.some((t) => t.id === value);
}

export function parseDocumentsTab(value: string | undefined): DocumentsTabId {
  return isDocumentsTab(value) ? value : 'dokumente';
}

export function kindsForDocumentsTab(tabId: DocumentsTabId): readonly DocumentationOverviewKind[] {
  return DOCUMENTS_TAB_KINDS[tabId];
}

export type DocumentsArtFilterId = 'plan' | 'leistungsverzeichnis' | 'dokument';

export const DOCUMENTS_ART_FILTERS: {
  id: DocumentsArtFilterId | null;
  label: string;
}[] = [
  { id: null, label: 'Alle' },
  { id: 'plan', label: 'Pläne' },
  { id: 'leistungsverzeichnis', label: 'Leistungsverzeichnis' },
  { id: 'dokument', label: 'Weitere Dokumente' },
];

export function artFilterToKind(art: DocumentsArtFilterId): DocumentationOverviewKind {
  switch (art) {
    case 'plan':
      return 'site_plan';
    case 'leistungsverzeichnis':
      return 'site_lv';
    case 'dokument':
      return 'site_other';
  }
}

export function parseDocumentsArtFilter(
  art: string | undefined,
  tabId: DocumentsTabId,
): DocumentsArtFilterId | null {
  if (tabId !== 'dokumente') return null;
  if (art === 'plan' || art === 'leistungsverzeichnis' || art === 'dokument') return art;
  return null;
}

export function parseReportArtFilter(
  art: string | undefined,
  tabId: DocumentsTabId,
): DailyLogReportType | null {
  if (tabId !== 'rapporte') return null;
  if (art && isDailyLogReportType(art)) return art;
  return null;
}

export type DocumentsListArtParam = DocumentsArtFilterId | DailyLogReportType;

export function artParamForTab(
  tabId: DocumentsTabId,
  siteDocArt: DocumentsArtFilterId | null,
  reportArt: DailyLogReportType | null,
): DocumentsListArtParam | null {
  if (tabId === 'dokumente') return siteDocArt;
  if (tabId === 'rapporte') return reportArt;
  return null;
}

export function kindsForTabWithArt(
  tabId: DocumentsTabId,
  art: DocumentsArtFilterId | null,
): readonly DocumentationOverviewKind[] {
  if (tabId !== 'dokumente' || !art) return kindsForDocumentsTab(tabId);
  return [artFilterToKind(art)];
}

export function siteDocumentCategoryForArt(
  art: DocumentsArtFilterId | null,
): 'plan' | 'leistungsverzeichnis' | 'other' | null {
  if (!art) return null;
  if (art === 'plan') return 'plan';
  if (art === 'leistungsverzeichnis') return 'leistungsverzeichnis';
  return 'other';
}

function kindSetIncludes(
  kinds: readonly DocumentationOverviewKind[],
  target: DocumentationOverviewKind,
): boolean {
  return kinds.includes(target);
}

export function tabNeedsSiteDocuments(kinds: readonly DocumentationOverviewKind[]): boolean {
  return (
    kindSetIncludes(kinds, 'site_plan') ||
    kindSetIncludes(kinds, 'site_lv') ||
    kindSetIncludes(kinds, 'site_other')
  );
}

export function tabNeedsPdfReports(kinds: readonly DocumentationOverviewKind[]): boolean {
  return kindSetIncludes(kinds, 'pdf_report');
}

export function tabNeedsReportPhotos(kinds: readonly DocumentationOverviewKind[]): boolean {
  return kindSetIncludes(kinds, 'report_photo');
}

export function tabNeedsDeliveryNotes(kinds: readonly DocumentationOverviewKind[]): boolean {
  return kindSetIncludes(kinds, 'delivery_note');
}

export function tabPanelTitle(tabId: DocumentsTabId): string {
  return DOCUMENTS_TABS.find((t) => t.id === tabId)?.label ?? 'Dokumente';
}

export function emptyStateMessage(tabId: DocumentsTabId): string {
  switch (tabId) {
    case 'dokumente':
      return 'Keine Baustellen-Dokumente für die aktuelle Auswahl. Pläne und Dateien werden auf der Baustelle hochgeladen.';
    case 'rapporte':
      return 'Keine PDF-Rapporte für die aktuelle Auswahl. Tagesberichte erfassen Sie unter Dokumentation.';
    case 'fotos':
      return 'Keine Fotos für die aktuelle Auswahl. Fotos werden in Tagesberichten hochgeladen.';
    case 'lieferscheine':
      return 'Keine Lieferscheine für die aktuelle Auswahl.';
    default:
      return 'Keine Einträge für die aktuelle Auswahl.';
  }
}

export function buildDocumentsPageHref(
  tabId: DocumentsTabId,
  siteId?: string | null,
  art?: DocumentsListArtParam | null,
): string {
  const params = new URLSearchParams();
  if (tabId !== 'dokumente') params.set('tab', tabId);
  if (siteId?.trim()) params.set('site', siteId.trim());
  if (tabId === 'dokumente' && art && isSiteDocumentArtFilter(art)) {
    params.set('art', art);
  }
  if (tabId === 'rapporte' && art && isDailyLogReportType(art)) {
    params.set('art', art);
  }
  const qs = params.toString();
  return qs ? `${DOCUMENTS_PAGE_PATH}?${qs}` : DOCUMENTS_PAGE_PATH;
}

function isSiteDocumentArtFilter(art: DocumentsListArtParam): art is DocumentsArtFilterId {
  return art === 'plan' || art === 'leistungsverzeichnis' || art === 'dokument';
}

export function filterItemsByKinds(
  items: { kind: DocumentationOverviewKind }[],
  kinds: readonly DocumentationOverviewKind[],
): typeof items {
  const allowed = new Set(kinds);
  return items.filter((item) => allowed.has(item.kind));
}
