'use server';

import { revalidatePath } from 'next/cache';
import type { PermissionKey } from '@/lib/auth/permissions';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { canViewAllSites } from '@/lib/sites/access';
import { isSiteIconKey } from '@/lib/sites/appearance-icons';
import { isImageSiteDocument } from '@/lib/sites/resolve-site-cover';
import { createClient } from '@/lib/supabase/server';
import {
  deletePrivateFile,
  uploadSiteCoverPhoto,
} from '@/lib/supabase/storage';
import type { SiteFormState } from '@/lib/actions/admin';

function siteFormError(e: unknown): SiteFormState {
  return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler' };
}

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

async function loadSiteForManage(siteId: string, tenantId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sites')
    .select('id, cover_image_path, cover_document_id')
    .eq('id', siteId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Baustelle nicht gefunden');
  return data;
}

async function clearUploadedCover(tenantId: string, path: string | null) {
  if (path) await deletePrivateFile(tenantId, 'site-documents', path);
}

export async function updateSiteIconAction(
  _prev: SiteFormState | null,
  formData: FormData,
): Promise<SiteFormState> {
  try {
    const ctx = await getActionContext();
    requirePerm(ctx, 'sites.appearance');
    const { tenantId } = ctx;
    const siteId = String(formData.get('site_id') ?? '').trim();
    const iconKey = String(formData.get('icon_key') ?? '').trim();
    if (!siteId) throw new Error('Keine Baustelle ausgewählt');
    if (!isSiteIconKey(iconKey)) throw new Error('Ungültiges Icon');

    const supabase = await createClient();
    const { error } = await supabase
      .from('sites')
      .update({ icon_key: iconKey, updated_at: new Date().toISOString() })
      .eq('id', siteId)
      .eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);

    revalidatePath(`/app/baustellen/${siteId}`);
    revalidatePath('/app/baustellen');
    return { ok: true, error: null };
  } catch (e) {
    return siteFormError(e);
  }
}

export async function uploadSiteCoverAction(
  _prev: SiteFormState | null,
  formData: FormData,
): Promise<SiteFormState> {
  try {
    const ctx = await getActionContext();
    requirePerm(ctx, 'sites.appearance');
    const { tenantId } = ctx;
    const siteId = String(formData.get('site_id') ?? '').trim();
    const file = formData.get('cover');
    if (!siteId) throw new Error('Keine Baustelle ausgewählt');
    if (!(file instanceof File) || file.size === 0) throw new Error('Keine Datei ausgewählt');

    const existing = await loadSiteForManage(siteId, tenantId);
    const path = await uploadSiteCoverPhoto(tenantId, siteId, file);

    const supabase = await createClient();
    const { error } = await supabase
      .from('sites')
      .update({
        cover_image_path: path,
        cover_document_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);

    if (existing.cover_image_path && existing.cover_image_path !== path) {
      await clearUploadedCover(tenantId, existing.cover_image_path);
    }

    revalidatePath(`/app/baustellen/${siteId}`);
    revalidatePath('/app/baustellen');
    return { ok: true, error: null };
  } catch (e) {
    return siteFormError(e);
  }
}

export async function setSiteCoverFromDocumentAction(
  _prev: SiteFormState | null,
  formData: FormData,
): Promise<SiteFormState> {
  try {
    const ctx = await getActionContext();
    requirePerm(ctx, 'sites.appearance');
    const { tenantId } = ctx;
    const siteId = String(formData.get('site_id') ?? '').trim();
    const documentId = String(formData.get('document_id') ?? '').trim();
    if (!siteId || !documentId) throw new Error('Auswahl unvollständig');

    const supabase = await createClient();
    const { data: doc, error: docError } = await supabase
      .from('site_documents')
      .select('id, site_id, file_type')
      .eq('id', documentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (docError) throw new Error(docError.message);
    if (!doc || doc.site_id !== siteId) throw new Error('Dokument nicht gefunden');
    if (!isImageSiteDocument(doc.file_type)) throw new Error('Nur Bild-Dokumente sind als Titelbild möglich');

    const existing = await loadSiteForManage(siteId, tenantId);

    const { error } = await supabase
      .from('sites')
      .update({
        cover_document_id: documentId,
        cover_image_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);

    if (existing.cover_image_path) {
      await clearUploadedCover(tenantId, existing.cover_image_path);
    }

    revalidatePath(`/app/baustellen/${siteId}`);
    revalidatePath('/app/baustellen');
    return { ok: true, error: null };
  } catch (e) {
    return siteFormError(e);
  }
}

export async function clearSiteCoverAction(
  _prev: SiteFormState | null,
  formData: FormData,
): Promise<SiteFormState> {
  try {
    const ctx = await getActionContext();
    requirePerm(ctx, 'sites.appearance');
    const { tenantId } = ctx;
    const siteId = String(formData.get('site_id') ?? '').trim();
    if (!siteId) throw new Error('Keine Baustelle ausgewählt');

    const existing = await loadSiteForManage(siteId, tenantId);

    const supabase = await createClient();
    const { error } = await supabase
      .from('sites')
      .update({
        cover_image_path: null,
        cover_document_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', siteId)
      .eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);

    if (existing.cover_image_path) {
      await clearUploadedCover(tenantId, existing.cover_image_path);
    }

    revalidatePath(`/app/baustellen/${siteId}`);
    revalidatePath('/app/baustellen');
    return { ok: true, error: null };
  } catch (e) {
    return siteFormError(e);
  }
}

export async function reorderSitesAction(siteIds: string[]): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ctx = await getActionContext();
    requirePerm(ctx, 'sites.manage');
    if (!canViewAllSites(ctx)) {
      throw new Error('Reihenfolge darf nur mit mandantenweiter Baustellen-Sicht geändert werden');
    }
    const { tenantId } = ctx;
    const ids = siteIds.filter(Boolean);
    if (ids.length === 0) return { ok: true };

    const supabase = await createClient();
    const { data: activeSites, error: loadError } = await supabase
      .from('sites')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (loadError) throw new Error(loadError.message);

    const allowed = new Set((activeSites ?? []).map((s) => s.id));
    if (ids.length !== allowed.size || ids.some((id) => !allowed.has(id))) {
      throw new Error('Ungültige Reihenfolge');
    }

    const updatedAt = new Date().toISOString();
    for (let index = 0; index < ids.length; index += 1) {
      const { error } = await supabase
        .from('sites')
        .update({ list_sort_order: index, updated_at: updatedAt })
        .eq('id', ids[index])
        .eq('tenant_id', tenantId);
      if (error) throw new Error(error.message);
    }

    revalidatePath('/app/baustellen');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler' };
  }
}
