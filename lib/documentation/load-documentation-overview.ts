import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionContext } from '@/lib/auth/session';
import { canViewAllReports, resolveOwnedDailyLogIds } from '@/lib/documentation/report-access';
import {
  mergeAndSortOverviewItems,
  OVERVIEW_PER_SOURCE_LIMIT,
  SITE_DOCUMENTS_OVERVIEW_SELECT,
  siteDocumentKind,
  type DocumentationOverviewItem,
  type SiteFilterOption,
} from '@/lib/documentation/documentation-overview-types';
import {
  applyAccessibleSiteIdFilter,
  fetchAccessibleSites,
  resolveAccessibleSiteIds,
} from '@/lib/sites/access';
import { getSignedFileUrls } from '@/lib/supabase/storage';
import {
  kindsForTabWithArt,
  parseDocumentsArtFilter,
  parseDocumentsTab,
  parseReportArtFilter,
  siteDocumentCategoryForArt,
  tabNeedsDeliveryNotes,
  tabNeedsPdfReports,
  tabNeedsReportPhotos,
  tabNeedsSiteDocuments,
  type DocumentsTabId,
} from '@/lib/documentation/documents-tabs';
import type { DocumentationOverviewKind } from '@/lib/documentation/documentation-overview-types';
import {
  displayTitleForLog,
  parseDailyLogReportType,
  shortLabelForReportType,
  tenantReportLabelsFromTenant,
  type DailyLogReportType,
} from '@/lib/documentation/report-labels';

type DailyLogJoin = {
  log_date: string;
  site_id: string;
  created_by: string | null;
  tenant_id: string;
  sites: { name: string } | { name: string }[] | null;
};

function siteNameFromJoin(sites: DailyLogJoin['sites']): string {
  if (!sites) return '';
  if (Array.isArray(sites)) return sites[0]?.name ?? '';
  return sites.name ?? '';
}

function parseDailyLogJoin(raw: unknown): DailyLogJoin | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  if (typeof record.site_id !== 'string' || typeof record.log_date !== 'string') return null;
  return {
    log_date: record.log_date,
    site_id: record.site_id,
    created_by: (record.created_by as string | null) ?? null,
    tenant_id: (record.tenant_id as string) ?? '',
    sites: record.sites as DailyLogJoin['sites'],
  };
}

function applyOptionalSiteFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  column: string,
  siteId: string | undefined,
): T {
  if (!siteId) return query;
  return query.eq(column, siteId);
}

export type DocumentationOverviewResult = {
  items: DocumentationOverviewItem[];
  sites: SiteFilterOption[];
  selectedSiteId: string | null;
};

export async function loadDocumentationOverview(
  supabase: SupabaseClient,
  ctx: SessionContext,
  options: {
    siteId?: string;
    tab?: DocumentsTabId;
    art?: string;
    kinds?: readonly DocumentationOverviewKind[];
  } = {},
): Promise<DocumentationOverviewResult> {
  const tenantId = ctx.tenant!.id;
  const accessibleSiteIds = await resolveAccessibleSiteIds(supabase, ctx);
  const filterSiteId = options.siteId?.trim() || undefined;

  if (
    filterSiteId &&
    accessibleSiteIds !== null &&
    !accessibleSiteIds.includes(filterSiteId)
  ) {
    return {
      items: [],
      sites: await loadSiteFilterOptions(supabase, ctx),
      selectedSiteId: null,
    };
  }

  const tab = options.tab ?? parseDocumentsTab(undefined);
  const artFilter = parseDocumentsArtFilter(options.art, tab);
  const reportArtFilter = parseReportArtFilter(options.art, tab);
  const kinds = options.kinds ?? kindsForTabWithArt(tab, artFilter);
  const siteDocCategory = siteDocumentCategoryForArt(artFilter);
  const reportLabels = tenantReportLabelsFromTenant(ctx.tenant);
  const needsOwnedLogs =
    tabNeedsPdfReports(kinds) || tabNeedsReportPhotos(kinds) || tabNeedsDeliveryNotes(kinds);

  const ownedLogIds = needsOwnedLogs
    ? await resolveOwnedDailyLogIds(supabase, ctx, tenantId, {
        siteId: filterSiteId,
      })
    : null;

  const [
    siteDocuments,
    reports,
    photos,
    deliveries,
    siteOptions,
  ] = await Promise.all([
    tabNeedsSiteDocuments(kinds)
      ? loadSiteDocuments(supabase, tenantId, accessibleSiteIds, filterSiteId, siteDocCategory)
      : Promise.resolve([]),
    tabNeedsPdfReports(kinds)
      ? loadPdfReports(
          supabase,
          tenantId,
          accessibleSiteIds,
          filterSiteId,
          ownedLogIds,
          reportArtFilter,
          reportLabels,
        )
      : Promise.resolve([]),
    tabNeedsReportPhotos(kinds)
      ? loadReportPhotos(supabase, tenantId, accessibleSiteIds, filterSiteId, ctx)
      : Promise.resolve([]),
    tabNeedsDeliveryNotes(kinds)
      ? loadDeliveryNotes(supabase, tenantId, accessibleSiteIds, filterSiteId, ctx)
      : Promise.resolve([]),
    loadSiteFilterOptions(supabase, ctx),
  ]);

  const items = mergeAndSortOverviewItems([
    ...siteDocuments,
    ...reports,
    ...photos,
    ...deliveries,
  ]);

  const siteDocPaths = items
    .filter((item) => item.kind.startsWith('site_') && item.fileUrl)
    .map((item) => item.fileUrl!) ;
  const dailyPhotoPaths = items
    .filter(
      (item) =>
        (item.kind === 'report_photo' || item.kind === 'delivery_note') && item.fileUrl,
    )
    .map((item) => item.fileUrl!);

  const [siteSigned, photoSigned] = await Promise.all([
    siteDocPaths.length
      ? getSignedFileUrls(tenantId, 'site-documents', siteDocPaths)
      : Promise.resolve(new Map<string, string>()),
    dailyPhotoPaths.length
      ? getSignedFileUrls(tenantId, 'daily-photos', dailyPhotoPaths)
      : Promise.resolve(new Map<string, string>()),
  ]);

  const resolvedItems = items.map((item) => {
    if (!item.fileUrl) return item;
    const bucket = item.kind.startsWith('site_') ? siteSigned : photoSigned;
    const signed = bucket.get(item.fileUrl);
    return signed ? { ...item, fileUrl: signed } : item;
  });

  return {
    items: resolvedItems,
    sites: siteOptions,
    selectedSiteId: filterSiteId && siteOptions.some((s) => s.id === filterSiteId) ? filterSiteId : null,
  };
}

async function loadSiteFilterOptions(
  supabase: SupabaseClient,
  ctx: SessionContext,
): Promise<SiteFilterOption[]> {
  const rows = await fetchAccessibleSites(supabase, ctx, 'id, name');
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

async function loadSiteDocuments(
  supabase: SupabaseClient,
  tenantId: string,
  accessibleSiteIds: string[] | null,
  filterSiteId: string | undefined,
  categoryFilter: 'plan' | 'leistungsverzeichnis' | 'other' | null = null,
): Promise<DocumentationOverviewItem[]> {
  let query = supabase
    .from('site_documents')
    .select(SITE_DOCUMENTS_OVERVIEW_SELECT)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(OVERVIEW_PER_SOURCE_LIMIT);
  query = applyAccessibleSiteIdFilter(query, 'site_id', accessibleSiteIds);
  query = applyOptionalSiteFilter(query, 'site_id', filterSiteId);
  if (categoryFilter === 'plan') {
    query = query.eq('category', 'plan');
  } else if (categoryFilter === 'leistungsverzeichnis') {
    query = query.eq('category', 'leistungsverzeichnis');
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).filter((row) => {
    if (categoryFilter !== 'other') return true;
    return siteDocumentKind(row.category as string | null) === 'site_other';
  });

  return rows.map((row) => {
    const siteRaw = row.sites as { name: string } | { name: string }[] | null;
    const siteName = Array.isArray(siteRaw) ? siteRaw[0]?.name ?? '' : siteRaw?.name ?? '';
    const sortDate = (row.created_at as string)?.slice(0, 10) ?? '';
    return {
      id: `doc-${row.id}`,
      kind: siteDocumentKind(row.category as string | null),
      sortDate,
      siteId: row.site_id as string,
      siteName,
      title: (row.title as string) || 'Dokument',
      fileUrl: (row.file_url as string | null) ?? undefined,
    };
  });
}

type PdfReportLogJoin = {
  report_type: string | null;
  custom_title: string | null;
};

function parsePdfReportLogJoin(raw: unknown): PdfReportLogJoin | null {
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  return {
    report_type: (record.report_type as string | null) ?? null,
    custom_title: (record.custom_title as string | null) ?? null,
  };
}

async function loadPdfReports(
  supabase: SupabaseClient,
  tenantId: string,
  accessibleSiteIds: string[] | null,
  filterSiteId: string | undefined,
  ownedLogIds: string[] | null,
  reportTypeFilter: DailyLogReportType | null,
  reportLabels: ReturnType<typeof tenantReportLabelsFromTenant>,
): Promise<DocumentationOverviewItem[]> {
  const { data: rawReports } = await supabase
    .from('reports')
    .select(
      'id, report_date, pdf_url, site_id, daily_log_id, sites(name), daily_logs(report_type, custom_title)',
    )
    .eq('tenant_id', tenantId)
    .not('pdf_url', 'is', null)
    .order('report_date', { ascending: false })
    .limit(OVERVIEW_PER_SOURCE_LIMIT);

  const ownedSet =
    ownedLogIds !== null ? new Set(ownedLogIds) : null;
  const accessibleSet =
    accessibleSiteIds !== null ? new Set(accessibleSiteIds) : null;

  const data = (rawReports ?? []).filter((row) => {
    const siteId = row.site_id as string;
    if (accessibleSet && !accessibleSet.has(siteId)) return false;
    if (filterSiteId && siteId !== filterSiteId) return false;
    if (ownedSet && !ownedSet.has(row.daily_log_id as string)) return false;
    const log = parsePdfReportLogJoin(row.daily_logs);
    const reportType = parseDailyLogReportType(log?.report_type);
    if (reportTypeFilter && reportType !== reportTypeFilter) return false;
    return true;
  });

  return data.map((row) => {
    const siteRaw = row.sites as { name: string } | { name: string }[] | null;
    const siteName = Array.isArray(siteRaw) ? siteRaw[0]?.name ?? '' : siteRaw?.name ?? '';
    const log = parsePdfReportLogJoin(row.daily_logs);
    const reportType = parseDailyLogReportType(log?.report_type);
    const title =
      displayTitleForLog(reportType, log?.custom_title, reportLabels) ||
      `Rapport ${row.report_date}`;
    return {
      id: `report-${row.id}`,
      kind: 'pdf_report' as const,
      sortDate: row.report_date as string,
      siteId: row.site_id as string,
      siteName,
      title,
      displayKind: shortLabelForReportType(reportType, reportLabels),
      reportId: row.id as string,
    };
  });
}

async function loadReportPhotos(
  supabase: SupabaseClient,
  tenantId: string,
  accessibleSiteIds: string[] | null,
  filterSiteId: string | undefined,
  ctx: SessionContext,
): Promise<DocumentationOverviewItem[]> {
  let query = supabase
    .from('daily_log_photos')
    .select(
      'id, file_url, caption, created_at, daily_logs!inner(log_date, site_id, created_by, tenant_id, sites(name))',
    )
    .eq('daily_logs.tenant_id', tenantId)
    .is('deleted_at', null)
    .not('file_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(OVERVIEW_PER_SOURCE_LIMIT);

  if (!canViewAllReports(ctx)) {
    query = query.eq('daily_logs.created_by', ctx.userId);
  }
  if (filterSiteId) {
    query = query.eq('daily_logs.site_id', filterSiteId);
  } else if (accessibleSiteIds !== null) {
    if (accessibleSiteIds.length === 0) return [];
    query = query.in('daily_logs.site_id', accessibleSiteIds);
  }

  const { data } = await query;

  const items: DocumentationOverviewItem[] = [];
  for (const row of data ?? []) {
    const log = parseDailyLogJoin(row.daily_logs);
    if (!log) continue;
    const sortDate =
      (row.created_at as string)?.slice(0, 10) || log.log_date;
    const title = (row.caption as string | null)?.trim() || `Foto · ${log.log_date}`;
    items.push({
      id: `photo-${row.id}`,
      kind: 'report_photo',
      sortDate,
      siteId: log.site_id,
      siteName: siteNameFromJoin(log.sites),
      title,
      fileUrl: row.file_url as string,
    });
  }
  return items;
}

async function loadDeliveryNotes(
  supabase: SupabaseClient,
  tenantId: string,
  accessibleSiteIds: string[] | null,
  filterSiteId: string | undefined,
  ctx: SessionContext,
): Promise<DocumentationOverviewItem[]> {
  let query = supabase
    .from('delivery_notes')
    .select(
      'id, supplier_name, delivery_note_number, delivery_date, description, file_url, created_at, daily_logs!inner(log_date, site_id, created_by, tenant_id, sites(name))',
    )
    .eq('daily_logs.tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(OVERVIEW_PER_SOURCE_LIMIT);

  if (!canViewAllReports(ctx)) {
    query = query.eq('daily_logs.created_by', ctx.userId);
  }
  if (filterSiteId) {
    query = query.eq('daily_logs.site_id', filterSiteId);
  } else if (accessibleSiteIds !== null) {
    if (accessibleSiteIds.length === 0) return [];
    query = query.in('daily_logs.site_id', accessibleSiteIds);
  }

  const { data } = await query;

  const items: DocumentationOverviewItem[] = [];
  for (const row of data ?? []) {
    const log = parseDailyLogJoin(row.daily_logs);
    if (!log) continue;
    const sortDate =
      (row.delivery_date as string | null) ||
      (row.created_at as string)?.slice(0, 10) ||
      log.log_date;
    const parts = [
      (row.supplier_name as string | null)?.trim(),
      (row.delivery_note_number as string | null)?.trim(),
    ].filter(Boolean);
    const title =
      parts.join(' · ') ||
      (row.description as string | null)?.trim()?.slice(0, 80) ||
      `Lieferschein · ${log.log_date}`;
    items.push({
      id: `delivery-${row.id}`,
      kind: 'delivery_note',
      sortDate,
      siteId: log.site_id,
      siteName: siteNameFromJoin(log.sites),
      title,
      fileUrl: (row.file_url as string | null) ?? undefined,
    });
  }
  return items;
}
