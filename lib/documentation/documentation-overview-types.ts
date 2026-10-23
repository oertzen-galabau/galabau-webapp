export type DocumentationOverviewKind =
  | 'site_plan'
  | 'site_lv'
  | 'site_other'
  | 'pdf_report'
  | 'report_photo'
  | 'delivery_note';

export type DocumentationOverviewItem = {
  id: string;
  kind: DocumentationOverviewKind;
  sortDate: string;
  siteId: string;
  siteName: string;
  title: string;
  reportId?: string;
  fileUrl?: string;
  /** Anzeige in Spalte „Art“, wenn abweichend von kindLabel(kind). */
  displayKind?: string;
};

export type SiteFilterOption = {
  id: string;
  name: string;
};

export const OVERVIEW_PER_SOURCE_LIMIT = 150;
export const OVERVIEW_MERGED_LIMIT = 200;

export function kindLabel(kind: DocumentationOverviewKind): string {
  switch (kind) {
    case 'site_plan':
      return 'Plan';
    case 'site_lv':
      return 'Leistungsverzeichnis';
    case 'site_other':
      return 'Dokument';
    case 'pdf_report':
      return 'PDF-Rapport';
    case 'report_photo':
      return 'Berichtsfoto';
    case 'delivery_note':
      return 'Lieferschein';
    default:
      return 'Dokument';
  }
}

export function siteDocumentKind(category: string | null): DocumentationOverviewKind {
  if (category === 'plan') return 'site_plan';
  if (category === 'leistungsverzeichnis') return 'site_lv';
  return 'site_other';
}

export function mergeAndSortOverviewItems(
  items: DocumentationOverviewItem[],
  limit = OVERVIEW_MERGED_LIMIT,
): DocumentationOverviewItem[] {
  return [...items]
    .sort((a, b) => {
      const dateCmp = b.sortDate.localeCompare(a.sortDate);
      if (dateCmp !== 0) return dateCmp;
      return a.title.localeCompare(b.title, 'de');
    })
    .slice(0, limit);
}
