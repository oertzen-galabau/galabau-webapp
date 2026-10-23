import { DEFAULT_SITE_ICON_KEY, isSiteIconKey } from '@/lib/sites/appearance-icons';
import type { Site } from '@/lib/types/database';

export type SiteCoverDisplay =
  | { kind: 'image'; url: string }
  | { kind: 'icon'; iconKey: string };

export type SiteCoverSource = Pick<
  Site,
  'id' | 'cover_image_path' | 'cover_document_id' | 'icon_key'
>;

/** Sammelt Storage-Pfade für Batch-Signierung (Cover-Upload + referenzierte Dokumente). */
export function collectSiteCoverStoragePaths(
  sites: SiteCoverSource[],
  documentPathById: Map<string, string>,
): string[] {
  const paths = new Set<string>();
  for (const site of sites) {
    if (site.cover_image_path) paths.add(site.cover_image_path);
    if (site.cover_document_id) {
      const docPath = documentPathById.get(site.cover_document_id);
      if (docPath) paths.add(docPath);
    }
  }
  return [...paths];
}

export function resolveSiteCover(
  site: SiteCoverSource,
  signedUrls: Map<string, string>,
  documentPathById: Map<string, string>,
): SiteCoverDisplay {
  if (site.cover_document_id) {
    const docPath = documentPathById.get(site.cover_document_id);
    if (docPath) {
      const url = signedUrls.get(docPath);
      if (url) return { kind: 'image', url };
    }
  }
  if (site.cover_image_path) {
    const url = signedUrls.get(site.cover_image_path);
    if (url) return { kind: 'image', url };
  }
  const iconKey = isSiteIconKey(site.icon_key) ? site.icon_key : DEFAULT_SITE_ICON_KEY;
  return { kind: 'icon', iconKey };
}

export function isImageSiteDocument(fileType: string | null | undefined): boolean {
  return Boolean(fileType?.startsWith('image/'));
}
