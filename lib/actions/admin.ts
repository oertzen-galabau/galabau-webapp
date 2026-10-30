'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { PermissionKey } from '@/lib/auth/permissions';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { buildStoragePath, deletePrivateFile, uploadPrivateFile } from '@/lib/supabase/storage';
import {
  assertDailyLogInTenant,
  assertProfileInTenant,
  assertSiteInTenant,
} from '@/lib/tenant/row-access';
import { enumRoleFromTenantRoleId } from '@/lib/tenant/roles';
import { canViewAllSites, requireSiteAccess } from '@/lib/sites/access';
import { readSiteAddressFromForm } from '@/lib/sites/format-address';
import { syncSiteGeocoding } from '@/lib/weather/sync-site-geocoding';
import { resolvePartnerName } from '@/lib/actions/partners';
import {
  deliveryBlockFromStandaloneForm,
  insertDeliveryNote,
  isDeliveryBlockEmpty,
} from '@/lib/documentation/save-delivery-note';
import { computeLeaderCode } from '@/lib/schedule/leader-code';

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

export type SiteFormState = { ok?: boolean; error?: string | null };

function siteFormError(e: unknown): SiteFormState {
  const message = e instanceof Error ? e.message : 'Speichern fehlgeschlagen';
  if (message.includes('Failed to find Server Action')) {
    return {
      error:
        'Die App wurde gerade aktualisiert. Bitte Seite neu laden (Strg/Cmd+R) und erneut speichern.',
    };
  }
  return { error: message };
}

export async function saveSite(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const { tenantId } = ctx;

  const supabase = await createClient();

  const siteAddress = readSiteAddressFromForm(formData);
  const responsibleRaw = (formData.get('responsible_user_id') as string)?.trim();
  // Wer keine mandantenweite Sicht hat (z.B. Vorarbeiter mit sites.manage), soll die
  // selbst angelegte Baustelle nicht sofort aus der eigenen Sicht verlieren (RLS-Filter
  // in lib/sites/access.ts zeigt Nicht-Verwaltung nur zugewiesene/verantwortete Sites).
  const responsible_user_id =
    responsibleRaw || (canViewAllSites(ctx) ? null : ctx.userId);

  // Verantwortlichen muss RLS lesen können (INSERT … RETURNING / SELECT-Policy)
  if (
    responsible_user_id &&
    responsible_user_id !== ctx.userId &&
    !canViewAllSites(ctx)
  ) {
    throw new Error(
      'Ohne mandantenweite Baustellen-Sicht darf nur der eigene Account als Verantwortlicher gesetzt werden — oder die Baustelle ohne VA anlegen (Sie werden dem Team zugewiesen).',
    );
  }

  const { data: maxSortRow } = await supabase
    .from('sites')
    .select('list_sort_order')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('list_sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const list_sort_order = (maxSortRow?.list_sort_order ?? -1) + 1;

  const { data: site, error } = await supabase
    .from('sites')
    .insert({
      tenant_id: tenantId,
      name: formData.get('name') as string,
      street: siteAddress.street,
      zip_code: siteAddress.zip_code,
      city: siteAddress.city,
      address: siteAddress.address,
      client_name: (formData.get('client_name') as string) || null,
      directions: (formData.get('directions') as string) || null,
      notes: (formData.get('notes') as string) || null,
      responsible_user_id,
      list_sort_order,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  await syncSiteGeocoding(supabase, site.id, tenantId, siteAddress.address);
  revalidatePath('/app/baustellen');
}

export async function saveSiteAction(
  _prev: SiteFormState | null,
  formData: FormData,
): Promise<SiteFormState> {
  try {
    await saveSite(formData);
    return { ok: true, error: null };
  } catch (e) {
    return siteFormError(e);
  }
}

export async function saveDailyLog(formData: FormData) {
  const ctx = await getActionContext();
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const siteId = formData.get('site_id') as string;
  const logDate = formData.get('log_date') as string;

  const { requireCanManageDailyReportForSiteDate } = await import('@/lib/documentation/report-access');
  await requireCanManageDailyReportForSiteDate(supabase, ctx, siteId, logDate, null);
  await requireSiteAccess(supabase, ctx, siteId, { planDate: logDate });

  const { data: log, error } = await supabase.from('daily_logs').upsert({
    tenant_id: tenantId,
    site_id: siteId,
    log_date: logDate,
    weather: (formData.get('weather') as string) || null,
    notes: (formData.get('notes') as string) || null,
    created_by: userId,
    report_type: 'hourly_wage_rapport',
  }, { onConflict: 'tenant_id,site_id,log_date,report_type' }).select('*').single();

  if (error || !log) throw new Error(error?.message ?? 'Fehler');

  const workDescriptions = formData.getAll('work_description[]');
  const workerHoursList = formData.getAll('worker_hours[]');
  const equipmentNames = formData.getAll('equipment_name[]');
  const equipmentHoursList = formData.getAll('equipment_hours[]');
  const rowCount = Math.max(
    workDescriptions.length,
    workerHoursList.length,
    equipmentNames.length,
    equipmentHoursList.length,
  );

  for (let i = 0; i < rowCount; i++) {
    const workDesc = String(workDescriptions[i] ?? '').trim();
    if (workDesc) {
      await supabase.from('daily_log_work').insert({
        tenant_id: tenantId,
        daily_log_id: log.id,
        description: workDesc,
        worker_hours: Number(workerHoursList[i] ?? 0),
      });
    }

    const equipmentName = String(equipmentNames[i] ?? '').trim();
    if (equipmentName) {
      await supabase.from('equipment_hours').insert({
        tenant_id: tenantId,
        daily_log_id: log.id,
        equipment_name: equipmentName,
        hours: Number(equipmentHoursList[i] ?? 0),
      });
    }
  }

  const photoFiles = formData.getAll('photos').filter(
    (entry): entry is File => entry instanceof File && entry.size > 0,
  );
  for (const file of photoFiles) {
    const path = buildStoragePath(tenantId, siteId, log.id, `${Date.now()}-${file.name}`);
    await uploadPrivateFile(tenantId, 'daily-photos', path, file);
    await supabase.from('daily_log_photos').insert({
      tenant_id: tenantId,
      daily_log_id: log.id,
      file_url: path,
      uploaded_by: userId,
    });
  }

  revalidatePath('/app/dokumentation');
  revalidatePath('/app/dokumente');
}

export async function saveDeliveryNote(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'documentation.manage');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const dailyLogId = formData.get('daily_log_id') as string;
  if (!dailyLogId) throw new Error('Kein Tageseintrag ausgewählt');
  await assertDailyLogInTenant(supabase, tenantId, dailyLogId);

  const block = deliveryBlockFromStandaloneForm(formData);
  if (isDeliveryBlockEmpty(block)) {
    throw new Error('Bitte Lieferant, Lieferschein oder mindestens eine Position angeben.');
  }
  await insertDeliveryNote(supabase, tenantId, dailyLogId, block);

  const { data: logRow } = await supabase
    .from('daily_logs')
    .select('site_id')
    .eq('id', dailyLogId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  revalidatePath('/app/dokumentation');
  revalidatePath('/app/dokumente');
  if (logRow?.site_id) {
    revalidatePath(`/app/baustellen/${logRow.site_id}`);
  }
}

export async function saveSubcontractorEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'documentation.manage');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const dailyLogId = formData.get('daily_log_id') as string;
  if (!dailyLogId) throw new Error('Kein Tageseintrag ausgewählt');
  await assertDailyLogInTenant(supabase, tenantId, dailyLogId);

  const partnerIdRaw = (formData.get('partner_id') as string)?.trim() || null;
  const partnerId = partnerIdRaw && partnerIdRaw !== '__custom__' ? partnerIdRaw : null;
  const { partnerId: resolvedPartnerId, displayName: companyName } = await resolvePartnerName(
    tenantId,
    partnerId,
    formData.get('company_name') as string,
    'subcontractor',
  );

  const { error } = await supabase.from('subcontractor_entries').insert({
    tenant_id: tenantId,
    daily_log_id: dailyLogId,
    partner_id: resolvedPartnerId,
    company_name: companyName,
    work_description: (formData.get('work_description') as string) || null,
    hours: Number(formData.get('hours') ?? 0),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/app/dokumentation');
  revalidatePath('/app/dokumente');
}

async function softDeleteDocumentationEntry(
  table: 'delivery_notes' | 'subcontractor_entries' | 'daily_log_photos',
  id: string,
) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'documentation.manage');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const { data: entry, error: loadError } = await supabase
    .from(table)
    .select('id, tenant_id, deleted_at')
    .eq('id', id)
    .single();

  if (loadError || !entry) throw new Error('Eintrag nicht gefunden');
  if (entry.tenant_id !== tenantId) throw new Error('Keine Berechtigung');
  if (entry.deleted_at) return;

  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/app/dokumentation');
  revalidatePath('/app/dokumente');
}

export async function softDeleteDeliveryNote(formData: FormData) {
  const id = formData.get('id') as string;
  if (!id) throw new Error('Kein Eintrag ausgewählt');
  await softDeleteDocumentationEntry('delivery_notes', id);
}

export async function softDeleteSubcontractorEntry(formData: FormData) {
  const id = formData.get('id') as string;
  if (!id) throw new Error('Kein Eintrag ausgewählt');
  await softDeleteDocumentationEntry('subcontractor_entries', id);
}

export async function softDeleteDailyLogPhoto(formData: FormData) {
  const id = formData.get('id') as string;
  if (!id) throw new Error('Kein Eintrag ausgewählt');
  await softDeleteDocumentationEntry('daily_log_photos', id);
}

export async function saveAssignment(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'infoboard.assignments');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const userId = formData.get('user_id') as string;
  const siteId = (formData.get('site_id') as string) || null;
  await assertProfileInTenant(supabase, tenantId, userId);
  if (siteId) await assertSiteInTenant(supabase, tenantId, siteId);
  const { error } = await supabase.from('daily_assignments').upsert({
    tenant_id: tenantId,
    user_id: userId,
    site_id: siteId,
    assignment_date: formData.get('assignment_date') as string,
    notes: (formData.get('notes') as string) || null,
  }, { onConflict: 'tenant_id,user_id,assignment_date' });
  if (error) throw new Error(error.message);
  revalidatePath('/app');
}

export async function updateSite(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const siteId = formData.get('site_id') as string;
  const siteAddress = readSiteAddressFromForm(formData);

  const { data: existing } = await supabase
    .from('sites')
    .select('street, zip_code, city, address, responsible_user_id')
    .eq('id', siteId)
    .eq('tenant_id', tenantId)
    .single();

  const responsibleRaw = (formData.get('responsible_user_id') as string)?.trim();
  // Wer keine mandantenweite Sicht hat, kann sich beim Leeren des Felds nicht selbst
  // aussperren — dann bleibt der bisherige Verantwortliche erhalten. Nur Verwaltung
  // darf den Verantwortlichen bewusst auf "keiner" zurücksetzen.
  const responsible_user_id = responsibleRaw
    ? responsibleRaw
    : canViewAllSites(ctx)
      ? null
      : existing?.responsible_user_id ?? null;

  const { error } = await supabase
    .from('sites')
    .update({
      street: siteAddress.street,
      zip_code: siteAddress.zip_code,
      city: siteAddress.city,
      address: siteAddress.address,
      directions: (formData.get('directions') as string) || null,
      default_travel_minutes: Number(formData.get('default_travel_minutes') ?? 0),
      client_name: (formData.get('client_name') as string) || null,
      start_date: (formData.get('start_date') as string) || null,
      end_date: (formData.get('end_date') as string) || null,
      notes: (formData.get('notes') as string) || null,
      responsible_user_id,
    })
    .eq('id', siteId)
    .eq('tenant_id', tenantId);

  if (error) throw new Error(error.message);

  const previousAddress = existing?.address ?? null;
  if (siteAddress.address !== previousAddress) {
    await syncSiteGeocoding(supabase, siteId, tenantId, siteAddress.address);
  }

  revalidatePath(`/app/baustellen/${siteId}`);
  revalidatePath('/app/baustellen');
}

export async function updateSiteAction(
  _prev: SiteFormState | null,
  formData: FormData,
): Promise<SiteFormState> {
  try {
    await updateSite(formData);
    return { ok: true, error: null };
  } catch (e) {
    return siteFormError(e);
  }
}

async function countSiteRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  siteId: string,
  tenantId: string,
) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function siteHasDocumentation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
  tenantId: string,
) {
  for (const table of ['site_documents', 'daily_logs', 'reports'] as const) {
    if ((await countSiteRows(supabase, table, siteId, tenantId)) > 0) return true;
  }
  return false;
}

async function siteHasOperationalData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
  tenantId: string,
) {
  for (const table of ['time_entries', 'time_entry_segments', 'daily_assignments', 'bad_weather_days'] as const) {
    if ((await countSiteRows(supabase, table, siteId, tenantId)) > 0) return true;
  }
  return false;
}

async function deleteSiteDocumentFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  siteId: string,
  tenantId: string,
) {
  const { data: docs, error } = await supabase
    .from('site_documents')
    .select('file_url')
    .eq('site_id', siteId)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);

  for (const doc of docs ?? []) {
    if (doc.file_url) await deletePrivateFile(tenantId, 'site-documents', doc.file_url);
  }
}

export async function removeSite(formData: FormData): Promise<{ action: 'archived' | 'deleted' }> {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const { tenantId } = ctx;

  const siteId = formData.get('site_id') as string;
  if (!siteId) throw new Error('Keine Baustelle ausgewählt');

  const supabase = await createClient();

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id')
    .eq('id', siteId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (siteError) throw new Error(siteError.message);
  if (!site) throw new Error('Baustelle nicht gefunden');

  const hasDocumentation = await siteHasDocumentation(supabase, siteId, tenantId);
  const hasOperationalData = await siteHasOperationalData(supabase, siteId, tenantId);

  if (hasDocumentation || hasOperationalData) {
    const { error } = await supabase
      .from('sites')
      .update({ is_active: false })
      .eq('id', siteId)
      .eq('tenant_id', tenantId);
    if (error) throw new Error(error.message);

    revalidatePath('/app/baustellen');
    revalidatePath(`/app/baustellen/${siteId}`);
    revalidatePath('/app/dokumentation');
    revalidatePath('/app/zeiten');
    return { action: 'archived' };
  }

  await deleteSiteDocumentFiles(supabase, siteId, tenantId);

  const { error: deleteError } = await supabase
    .from('sites')
    .delete()
    .eq('id', siteId)
    .eq('tenant_id', tenantId);

  if (deleteError) {
    const { error: archiveError } = await supabase
      .from('sites')
      .update({ is_active: false })
      .eq('id', siteId)
      .eq('tenant_id', tenantId);
    if (archiveError) throw new Error(archiveError.message);

    revalidatePath('/app/baustellen');
    revalidatePath(`/app/baustellen/${siteId}`);
    revalidatePath('/app/dokumentation');
    revalidatePath('/app/zeiten');
    return { action: 'archived' };
  }

  revalidatePath('/app/baustellen');
  revalidatePath('/app/dokumentation');
  revalidatePath('/app/zeiten');
  return { action: 'deleted' };
}

export async function saveSiteContacts(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const siteId = formData.get('site_id') as string;
  await assertSiteInTenant(supabase, tenantId, siteId);
  const names = formData.getAll('name[]');
  const roles = formData.getAll('role[]');
  const phones = formData.getAll('phone[]');
  const emails = formData.getAll('email[]');
  const rowCount = names.length;

  for (let i = 0; i < rowCount; i++) {
    const name = String(names[i] ?? '').trim();
    if (!name) continue;
    const { error } = await supabase.from('site_contacts').insert({
      tenant_id: tenantId,
      site_id: siteId,
      name,
      role: String(roles[i] ?? '').trim() || null,
      phone: String(phones[i] ?? '').trim() || null,
      email: String(emails[i] ?? '').trim() || null,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/app/baustellen/${siteId}`);
}

export async function saveSiteAppointments(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const siteId = formData.get('site_id') as string;
  await assertSiteInTenant(supabase, tenantId, siteId);
  const titles = formData.getAll('title[]');
  const dates = formData.getAll('appointment_date[]');
  const times = formData.getAll('appointment_time[]');
  const notesList = formData.getAll('notes[]');
  const rowCount = titles.length;

  for (let i = 0; i < rowCount; i++) {
    const title = String(titles[i] ?? '').trim();
    const date = String(dates[i] ?? '').trim();
    if (!title || !date) continue;
    const time = String(times[i] ?? '08:00').trim() || '08:00';
    const appointmentAt = new Date(`${date}T${time}:00`).toISOString();

    const { error } = await supabase.from('site_appointments').insert({
      tenant_id: tenantId,
      site_id: siteId,
      title,
      appointment_at: appointmentAt,
      notes: String(notesList[i] ?? '').trim() || null,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/app/baustellen/${siteId}`);
}

async function deleteSiteEntity(
  table: 'site_contacts' | 'site_suppliers' | 'site_appointments' | 'site_documents',
  id: string,
  tenantId: string,
) {
  const supabase = await createClient();
  const { data, error: fetchError } = await supabase
    .from(table)
    .select('id, site_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!data) throw new Error('Eintrag nicht gefunden');

  const { error } = await supabase.from(table).delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);

  return data.site_id as string;
}

export async function deleteSiteContact(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const id = formData.get('id') as string;
  if (!id) throw new Error('Kein Eintrag ausgewählt');
  const siteId = await deleteSiteEntity('site_contacts', id, ctx.tenantId);
  revalidatePath(`/app/baustellen/${siteId}`);
}

export async function deleteSiteSupplier(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const id = formData.get('id') as string;
  if (!id) throw new Error('Kein Eintrag ausgewählt');
  const siteId = await deleteSiteEntity('site_suppliers', id, ctx.tenantId);
  revalidatePath(`/app/baustellen/${siteId}`);
}

export async function updateSiteContact(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const { tenantId } = ctx;

  const id = formData.get('id') as string;
  const siteId = formData.get('site_id') as string;
  const name = String(formData.get('name') ?? '').trim();
  if (!id || !siteId || !name) throw new Error('Pflichtfelder fehlen.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('site_contacts')
    .update({
      name,
      role: String(formData.get('role') ?? '').trim() || null,
      phone: String(formData.get('phone') ?? '').trim() || null,
      email: String(formData.get('email') ?? '').trim() || null,
    })
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/baustellen/${siteId}`);
}

export async function deleteSiteAppointment(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const id = formData.get('id') as string;
  if (!id) throw new Error('Kein Eintrag ausgewählt');
  const siteId = await deleteSiteEntity('site_appointments', id, ctx.tenantId);
  revalidatePath(`/app/baustellen/${siteId}`);
}

export async function deleteSiteDocument(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const { tenantId } = ctx;
  const id = formData.get('id') as string;
  if (!id) throw new Error('Kein Eintrag ausgewählt');

  const supabase = await createClient();
  const { data, error: fetchError } = await supabase
    .from('site_documents')
    .select('id, site_id, file_url')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!data) throw new Error('Dokument nicht gefunden');

  await deletePrivateFile(tenantId, 'site-documents', data.file_url);

  const { error } = await supabase.from('site_documents').delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);

  revalidatePath(`/app/baustellen/${data.site_id}`);
  revalidatePath('/app/baustellen');
  revalidatePath('/app/dokumentation');
  revalidatePath('/app/dokumente');
}

export async function uploadSiteDocument(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const siteId = formData.get('site_id') as string;
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('Keine Datei ausgewählt');

  const category = (formData.get('category') as string) || 'sonstiges';
  const title = (formData.get('title') as string) || file.name;

  const path = buildStoragePath(tenantId, siteId, 'dokumente', `${Date.now()}-${file.name}`);
  await uploadPrivateFile(tenantId, 'site-documents', path, file);

  const { error } = await supabase.from('site_documents').insert({
    tenant_id: tenantId,
    site_id: siteId,
    title,
    file_url: path,
    file_type: file.type || null,
    category,
    uploaded_by: userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/baustellen/${siteId}`);
  revalidatePath('/app/dokumentation');
  revalidatePath('/app/dokumente');
}

export async function uploadSiteDocumentAction(
  _prev: SiteFormState | null,
  formData: FormData,
): Promise<SiteFormState> {
  try {
    await uploadSiteDocument(formData);
    return { ok: true, error: null };
  } catch (e) {
    return siteFormError(e);
  }
}

export async function saveCompanyHoliday(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.holidays');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const { error } = await supabase.from('company_holidays').insert({
    tenant_id: tenantId,
    title: formData.get('title') as string,
    start_date: formData.get('start_date') as string,
    end_date: formData.get('end_date') as string,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app/urlaub');
}

export async function deleteCompanyHoliday(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.holidays');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const { error } = await supabase
    .from('company_holidays')
    .delete()
    .eq('id', formData.get('id') as string)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app/urlaub');
}

export async function saveBridgeDay(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.holidays');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const { error } = await supabase.from('bridge_days').insert({
    tenant_id: tenantId,
    title: formData.get('title') as string,
    date: formData.get('date') as string,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app/urlaub');
}

export async function deleteBridgeDay(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.holidays');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const { error } = await supabase
    .from('bridge_days')
    .delete()
    .eq('id', formData.get('id') as string)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app/urlaub');
}

export async function updateTenantBadWeatherAllowance(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.holidays');
  const { tenantId } = ctx;

  const raw = formData.get('bad_weather_allowance_days');
  const parsed = Number(raw);
  if (raw == null || String(raw).trim() === '' || Number.isNaN(parsed)) {
    throw new Error('Bitte eine gültige Anzahl angeben.');
  }
  const days = Math.round(parsed);
  if (days < 0 || days > 366) {
    throw new Error('Die Anzahl muss zwischen 0 und 366 liegen.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({ bad_weather_allowance_days: days, updated_at: new Date().toISOString() })
    .eq('id', tenantId);
  if (error) throw new Error(error.message);

  revalidatePath('/app/einstellungen');
  revalidatePath('/app/urlaub');
}

export async function updateTenantGpsEnabled(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.gps');
  const { tenantId } = ctx;

  const enabled = formData.get('gps_enabled') === 'on';

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({ gps_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', tenantId);
  if (error) throw new Error(error.message);

  revalidatePath('/app', 'layout');
}

export async function updateLeaveEntitlement(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'team.leave_entitlement');
  const { tenantId } = ctx;

  const { parseHalfDayField } = await import('@/lib/leave/carry-over');
  const supabase = await createClient();
  const targetUserId = formData.get('user_id') as string;
  const year = Number(formData.get('year') ?? new Date().getFullYear());
  const entitlementDays = parseHalfDayField(formData.get('entitlement_days'), 30);
  const carriedOverDays = parseHalfDayField(formData.get('carried_over_days'), 0);

  const { data: existing } = await supabase
    .from('leave_balances')
    .select('used_days')
    .eq('tenant_id', tenantId)
    .eq('user_id', targetUserId)
    .eq('year', year)
    .maybeSingle();

  const { error } = await supabase.from('leave_balances').upsert(
    {
      tenant_id: tenantId,
      user_id: targetUserId,
      year,
      entitlement_days: entitlementDays,
      carried_over_days: carriedOverDays,
      used_days: existing?.used_days ?? 0,
      carried_over_source: 'manual',
    },
    { onConflict: 'tenant_id,user_id,year' },
  );
  if (error) throw new Error(error.message);
  revalidateEmployeePaths(targetUserId);
  revalidatePath('/app/urlaub/konto');
}

export async function recalculateLeaveCarryFromPreviousYear(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'team.leave_entitlement');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const targetUserId = formData.get('user_id') as string;
  const year = Number(formData.get('year') ?? new Date().getFullYear());

  const { syncAutomaticCarriedOverToDb } = await import('@/lib/leave/balance');
  await syncAutomaticCarriedOverToDb(supabase, tenantId, targetUserId, year);

  revalidateEmployeePaths(targetUserId);
  revalidatePath('/app/urlaub/konto');
}

export async function updateTenantLeaveCarryExpiry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.holidays');
  const { tenantId } = ctx;

  const monthRaw = (formData.get('leave_carry_expire_month') as string)?.trim();
  const dayRaw = (formData.get('leave_carry_expire_day') as string)?.trim();

  let leave_carry_expire_month: number | null = null;
  let leave_carry_expire_day: number | null = null;

  if (monthRaw || dayRaw) {
    if (!monthRaw || !dayRaw) {
      throw new Error('Monat und Tag für den Verfall müssen zusammen gesetzt oder leer sein.');
    }
    leave_carry_expire_month = Number(monthRaw);
    leave_carry_expire_day = Number(dayRaw);
    if (
      Number.isNaN(leave_carry_expire_month) ||
      Number.isNaN(leave_carry_expire_day) ||
      leave_carry_expire_month < 1 ||
      leave_carry_expire_month > 12 ||
      leave_carry_expire_day < 1 ||
      leave_carry_expire_day > 31
    ) {
      throw new Error('Ungültiger Verfallsstichtag.');
    }
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({
      leave_carry_expire_month,
      leave_carry_expire_day,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);
  if (error) throw new Error(error.message);

  revalidatePath('/app/einstellungen');
  revalidatePath('/app/urlaub');
  revalidatePath('/app/urlaub/konto');
  revalidatePath('/app/team', 'layout');
}

export async function updateTenantStartPassword(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.start_password');
  const { tenantId } = ctx;

  const password = (formData.get('password') as string) ?? '';
  const confirmPassword = (formData.get('confirm_password') as string) ?? '';

  if (password.length < 8) {
    throw new Error('Das Startpasswort muss mindestens 8 Zeichen haben.');
  }
  if (password !== confirmPassword) {
    throw new Error('Passwort und Bestätigung stimmen nicht überein.');
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  const { error: tenantError } = await admin
    .from('tenants')
    .update({ default_start_password: password })
    .eq('id', tenantId);

  if (tenantError) throw new Error(tenantError.message);

  revalidatePath('/app/einstellungen');
}

export type EmployeeInviteResult =
  | {
      ok: true;
      userId: string;
      email: string;
      firstName: string;
      inviteUrl: string;
      tempPassword: string;
      expiresAt: string;
      emailSent: boolean;
      emailMessage?: string;
    }
  | { ok: false; error: string };

async function provisionEmployeeInvitation(
  admin: Awaited<ReturnType<typeof import('@/lib/supabase/admin')['createAdminClient']>>,
  input: {
    tenantId: string;
    userId: string;
    actorUserId: string;
    email: string;
    firstName: string;
    tempPassword: string;
  },
): Promise<EmployeeInviteResult> {
  const { generateTempPassword } = await import('@/lib/auth/employee-invitations');
  const { createEmployeeInvitation } = await import('@/lib/team/employee-invite-service');
  const { sendEmployeeInvitationEmail } = await import('@/lib/email/employee-invitation');
  const { getPlatformName } = await import('@/lib/tenant/config');

  const tempPassword = input.tempPassword || generateTempPassword();

  const { error: profileError } = await admin
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', input.userId);

  if (profileError) throw new Error(profileError.message);

  const invite = await createEmployeeInvitation(admin, {
    tenantId: input.tenantId,
    userId: input.userId,
    createdBy: input.actorUserId,
    tempPassword,
  });

  const mailResult = await sendEmployeeInvitationEmail({
    to: input.email,
    firstName: input.firstName,
    platformName: getPlatformName(),
    inviteUrl: invite.inviteUrl,
    tempPassword,
    expiresAt: invite.expiresAt,
  });

  return {
    ok: true,
    userId: input.userId,
    email: input.email,
    firstName: input.firstName,
    inviteUrl: invite.inviteUrl,
    tempPassword,
    expiresAt: invite.expiresAt.toISOString(),
    emailSent: mailResult.ok,
    emailMessage: mailResult.ok
      ? undefined
      : mailResult.simulated
        ? mailResult.message
        : mailResult.error,
  };
}

export async function inviteEmployee(
  _prev: EmployeeInviteResult | null,
  formData: FormData,
): Promise<EmployeeInviteResult> {
  try {
    const ctx = await getActionContext();
    requirePerm(ctx, 'team.invite');
    const { tenantId, userId: actorUserId } = ctx;

    const email = ((formData.get('email') as string) ?? '').trim().toLowerCase();
    const firstName = ((formData.get('first_name') as string) ?? '').trim();
    const lastName = ((formData.get('last_name') as string) ?? '').trim();
    const jobTitle = ((formData.get('job_title') as string) || '').trim() || null;
    const workAreaIdRaw = ((formData.get('work_area_id') as string) || '').trim();
    const workAreaId = workAreaIdRaw || null;
    const tenantRoleId = formData.get('tenant_role_id') as string;

    if (!email || !firstName || !lastName) {
      return { ok: false, error: 'Bitte füllen Sie alle Pflichtfelder aus.' };
    }
    if (!tenantRoleId) return { ok: false, error: 'Ungültige Rolle' };

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const { generateTempPassword } = await import('@/lib/auth/employee-invitations');
    const admin = createAdminClient();

    const { data: tenantRole } = await admin
      .from('tenant_roles')
      .select('id')
      .eq('id', tenantRoleId)
      .eq('tenant_id', tenantId)
      .single();

    if (!tenantRole) return { ok: false, error: 'Ungültige Rolle' };

    if (workAreaId) {
      const { data: workArea } = await admin
        .from('tenant_work_areas')
        .select('id')
        .eq('id', workAreaId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .maybeSingle();
      if (!workArea) return { ok: false, error: 'Ungültiger Mitarbeiter-Bereich' };
    }

    const enumRole = await enumRoleFromTenantRoleId(admin, tenantRoleId);
    const tempPassword = generateTempPassword();
    const inaccessibleBootstrapPassword = generateTempPassword(32);

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: inaccessibleBootstrapPassword,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (authError || !authUser.user) {
      return { ok: false, error: authError?.message ?? 'Benutzer konnte nicht angelegt werden' };
    }

    const userId = authUser.user.id;

    const { error: profileError } = await admin.from('profiles').update({
      tenant_id: tenantId,
      tenant_role_id: tenantRoleId,
      role: enumRole,
      first_name: firstName,
      last_name: lastName,
      job_title: jobTitle,
      work_area_id: workAreaId,
      email,
      must_change_password: true,
    }).eq('id', userId);

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: profileError.message };
    }

    try {
      const result = await provisionEmployeeInvitation(admin, {
        tenantId,
        userId,
        actorUserId,
        email,
        firstName,
        tempPassword,
      });
      revalidateEmployeePaths(userId);
      return result;
    } catch (inviteError) {
      await admin.auth.admin.deleteUser(userId);
      throw inviteError;
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Mitarbeiter konnte nicht angelegt werden.';
    const { formatProductionConfigError } = await import('@/lib/auth/production-config-errors');
    return { ok: false, error: formatProductionConfigError(raw) };
  }
}

export async function regenerateEmployeeInvite(
  _prev: EmployeeInviteResult | null,
  formData: FormData,
): Promise<EmployeeInviteResult> {
  try {
    const ctx = await getActionContext();
    requirePerm(ctx, 'team.manage_invites');
    const { tenantId, userId: actorUserId } = ctx;

    const targetUserId = formData.get('user_id') as string;
    if (!targetUserId) return { ok: false, error: 'Mitarbeiter nicht gefunden.' };

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, email, first_name, last_name, tenant_id, must_change_password')
      .eq('id', targetUserId)
      .single();

    if (profileError || !profile) return { ok: false, error: 'Mitarbeiter nicht gefunden.' };
    if (profile.tenant_id !== tenantId) return { ok: false, error: 'Keine Berechtigung.' };
    if (!profile.email) return { ok: false, error: 'E-Mail-Adresse fehlt.' };
    if (!profile.must_change_password) {
      return { ok: false, error: 'Dieses Konto ist bereits aktiviert. Einladungen können nur vor dem Erstlogin erneuert werden.' };
    }

    const result = await provisionEmployeeInvitation(admin, {
      tenantId,
      userId: targetUserId,
      actorUserId,
      email: profile.email,
      firstName: profile.first_name,
      tempPassword: '',
    });

    revalidateEmployeePaths(targetUserId);
    return result;
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Einladung konnte nicht erneuert werden.';
    const { formatProductionConfigError } = await import('@/lib/auth/production-config-errors');
    return { ok: false, error: formatProductionConfigError(raw) };
  }
}

export async function updateMemberRole(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'team.assign_role');
  const { tenantId, userId } = ctx;

  const targetUserId = formData.get('user_id') as string;
  const tenantRoleId = formData.get('tenant_role_id') as string;

  if (!tenantRoleId) throw new Error('Ungültige Rolle');

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { assignProfileToRole } = await import('@/lib/auth/role-assignment');
  const admin = createAdminClient();

  const enumRole = await enumRoleFromTenantRoleId(admin, tenantRoleId);

  await assignProfileToRole(admin, {
    tenantId,
    actorUserId: userId,
    targetUserId,
    newRoleId: tenantRoleId,
    enumRole,
  });

  revalidateEmployeePaths(targetUserId);
}

function revalidateEmployeePaths(userId: string) {
  revalidatePath('/app/team');
  revalidatePath(`/app/team/${userId}`);
  revalidatePath('/app/baustellen', 'layout');
  revalidatePath('/app/einsatzplanung');
}

async function assertTenantMember(
  admin: Awaited<ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>>,
  tenantId: string,
  targetUserId: string,
) {
  const { data: targetProfile, error } = await admin
    .from('profiles')
    .select('id, tenant_id')
    .eq('id', targetUserId)
    .single();

  if (error || !targetProfile) throw new Error('Mitarbeiter nicht gefunden');
  if (targetProfile.tenant_id !== tenantId) throw new Error('Keine Berechtigung');
  return targetProfile;
}

export async function updateEmployeeProfile(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'team.edit_profile');
  const { tenantId } = ctx;

  const targetUserId = formData.get('user_id') as string;
  const email = (formData.get('email') as string)?.trim();
  if (!email) throw new Error('E-Mail ist erforderlich');

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  await assertTenantMember(admin, tenantId, targetUserId);

  const existingFlags = await admin
    .from('profiles')
    .select('payroll_flags')
    .eq('id', targetUserId)
    .single();
  const payrollFlags = {
    ...((existingFlags.data?.payroll_flags as Record<string, unknown>) ?? {}),
    lkw_hours: formData.get('payroll_lkw_hours') === 'on',
  };

  const firstName = formData.get('first_name') as string;
  const lastName = formData.get('last_name') as string;
  const profileUpdate = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone: (formData.get('phone') as string) || null,
    personnel_number: (formData.get('personnel_number') as string) || null,
    payroll_flags: payrollFlags,
    salutation: (formData.get('salutation') as string) || null,
    address: (formData.get('address') as string) || null,
    zip_code: (formData.get('zip_code') as string) || null,
    city: (formData.get('city') as string) || null,
    birthday: (formData.get('birthday') as string) || null,
    entry_date: (formData.get('entry_date') as string) || null,
    exit_date: (formData.get('exit_date') as string) || null,
    job_title: (formData.get('job_title') as string) || null,
    work_area_id: ((formData.get('work_area_id') as string) || '').trim() || null,
    leader_code: computeLeaderCode(firstName, lastName),
  };

  const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, { email });
  if (authError) throw new Error(authError.message);

  const { error } = await admin.from('profiles').update(profileUpdate).eq('id', targetUserId);
  if (error) throw new Error(error.message);

  revalidateEmployeePaths(targetUserId);
}

export async function updateEmployeeProfileAction(
  _prev: SiteFormState | null,
  formData: FormData,
): Promise<SiteFormState> {
  try {
    await updateEmployeeProfile(formData);
    return { ok: true, error: null };
  } catch (e) {
    return siteFormError(e);
  }
}

export async function setMemberActive(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'team.deactivate');
  const { tenantId, userId } = ctx;

  const targetUserId = formData.get('user_id') as string;
  const isActive = formData.get('is_active') === 'true';

  if (targetUserId === userId && !isActive) {
    throw new Error('Sie können sich nicht selbst deaktivieren.');
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  await assertTenantMember(admin, tenantId, targetUserId);

  const { error } = await admin.from('profiles').update({ is_active: isActive }).eq('id', targetUserId);
  if (error) throw new Error(error.message);

  revalidateEmployeePaths(targetUserId);
}

export async function deleteTeamMember(formData: FormData) {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'team.delete') && !canAccess(ctx, 'team.deactivate')) {
    throw new Error('Keine Berechtigung');
  }
  const { tenantId, userId } = ctx;

  const targetUserId = formData.get('user_id') as string;
  if (!targetUserId) throw new Error('Mitarbeiter nicht gefunden.');

  if (targetUserId === userId) {
    throw new Error('Sie können Ihr eigenes Konto nicht löschen.');
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  await assertTenantMember(admin, tenantId, targetUserId);

  const { error } = await admin.auth.admin.deleteUser(targetUserId);
  if (error) throw new Error(error.message);

  revalidatePath('/app/team');
  revalidatePath('/app/baustellen', 'layout');
  revalidatePath('/app/einsatzplanung');
}

export async function sendEmployeePasswordReset(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'team.password_reset');
  const { tenantId } = ctx;

  const targetUserId = formData.get('user_id') as string;

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  await assertTenantMember(admin, tenantId, targetUserId);

  const { data: profile } = await admin.from('profiles').select('email').eq('id', targetUserId).single();
  if (!profile?.email) throw new Error('Keine E-Mail hinterlegt');

  const { requestPasswordResetCode } = await import('@/lib/actions/password-reset');
  const result = await requestPasswordResetCode(profile.email);
  if (!result.ok) throw new Error(result.error);

  revalidateEmployeePaths(targetUserId);
}

export async function saveEmployeeNote(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'team.notes');
  const { tenantId, userId } = ctx;

  const targetUserId = formData.get('user_id') as string;
  const content = (formData.get('content') as string)?.trim();
  if (!content) throw new Error('Notiz darf nicht leer sein');

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  await assertTenantMember(admin, tenantId, targetUserId);

  const { error } = await admin.from('employee_notes').insert({
    tenant_id: tenantId,
    user_id: targetUserId,
    content,
    created_by: userId,
  });
  if (error) throw new Error(error.message);

  revalidateEmployeePaths(targetUserId);
}
