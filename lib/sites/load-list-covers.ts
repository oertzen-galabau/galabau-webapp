import type { SupabaseClient } from '@supabase/supabase-js';
import { collectSiteCoverStoragePaths, type SiteCoverSource } from '@/lib/sites/resolve-site-cover';
import { getSignedFileUrls } from '@/lib/supabase/storage';

export async function loadSiteListCoverContext(
  supabase: SupabaseClient,
  tenantId: string,
  sites: SiteCoverSource[],
) {
  const coverDocIds = [
    ...new Set(sites.map((s) => s.cover_document_id).filter(Boolean)),
  ] as string[];

  const documentPathById = new Map<string, string>();
  if (coverDocIds.length > 0) {
    const { data: coverDocs } = await supabase
      .from('site_documents')
      .select('id, file_url')
      .eq('tenant_id', tenantId)
      .in('id', coverDocIds);
    for (const doc of coverDocs ?? []) {
      if (doc.file_url) documentPathById.set(doc.id, doc.file_url);
    }
  }

  const paths = collectSiteCoverStoragePaths(sites, documentPathById);
  const signedMap = await getSignedFileUrls(tenantId, 'site-documents', paths);

  return {
    documentPathById: Object.fromEntries(documentPathById),
    signedUrls: Object.fromEntries(signedMap),
  };
}
