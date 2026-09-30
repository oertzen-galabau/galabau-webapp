'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { PermissionKey } from '@/lib/auth/permissions';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { buildStoragePath, deletePrivateFile, uploadPrivateFile } from '@/lib/supabase/storage';
import { enumRoleFromTenantRoleId } from '@/lib/tenant/roles';
import { canViewAllSites } from '@/lib/sites/access';
import { readSiteAddressFromForm } from '@/lib/sites/format-address';
import { syncSiteGeocoding } from '@/lib/weather/sync-site-geocoding';

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
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
  const responsible_user_id = responsibleRaw || (canViewAllSites(ctx) ? null : ctx.userId);

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
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  await syncSiteGeocoding(supabase, site.id, tenantId, siteAddress.address);
  revalidatePath('/app/baustellen');
}

export async function saveDailyLog(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'documentation.manage');
  const { tenantId, userId } = ctx;

  const supabase = await createClient();
  const siteId = formData.get('site_id') as string;
  const logDate = formData.get('log_date') as string;

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
    await uploadPrivateFile('daily-photos', path, file);
    await supabase.from('daily_log_photos').insert({
      tenant_id: tenantId,
      daily_log_id: log.id,
      file_url: path,
      uploaded_by: userId,
    });
  }

  revalidatePath('/app/dokumentation');
}

export async function saveDeliveryNote(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'documentation.manage');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const dailyLogId = formData.get('daily_log_id') as string;
  if (!dailyLogId) throw new Error('Kein Tageseintrag ausgewählt');

  const supplierName = (formData.get('supplier_name') as string) || null;
  const deliveryNoteNumber = (formData.get('delivery_note_number') as string) || null;
  const deliveryDate = (formData.get('delivery_date') as string) || null;
  const description = (formData.get('description') as string) || null;
  const extractionStatusRaw = (formData.get('extraction_status') as string) || 'manual';
  const extractionStatus = ['pending', 'success', 'failed', 'manual'].includes(extractionStatusRaw)
    ? extractionStatusRaw
    : 'manual';
  const rawExtractionRaw = formData.get('raw_extraction') as string;
  const file = formData.get('delivery_file');

  let rawExtraction: Record<string, unknown> | null = null;
  if (rawExtractionRaw) {
    try {
      rawExtraction = JSON.parse(rawExtractionRaw) as Record<string, unknown>;
    } catch {
      rawExtraction = null;
    }
  }

  let fileUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    const path = buildStoragePath(tenantId, 'lieferungen', dailyLogId, `${Date.now()}-${file.name}`);
    fileUrl = await uploadPrivateFile('daily-photos', path, file);
  }

  const { data: deliveryNote, error } = await supabase
    .from('delivery_notes')
    .insert({
      tenant_id: tenantId,
      daily_log_id: dailyLogId,
      supplier_name: supplierName,
      delivery_note_number: deliveryNoteNumber,
      delivery_date: deliveryDate || null,
      description,
      file_url: fileUrl,
      extraction_status: extractionStatus,
      raw_extraction: rawExtraction,
    })
    .select('id')
    .single();

  if (error || !deliveryNote) throw new Error(error?.message ?? 'Fehler beim Speichern');

  const itemDescriptions = formData.getAll('item_description[]');
  const itemQuantities = formData.getAll('item_quantity[]');
  const itemUnits = formData.getAll('item_unit[]');
  const rowCount = Math.max(itemDescriptions.length, itemQuantities.length, itemUnits.length);

  const items = [];
  for (let i = 0; i < rowCount; i++) {
    const itemDescription = String(itemDescriptions[i] ?? '').trim();
    if (!itemDescription) continue;
    const quantityRaw = String(itemQuantities[i] ?? '').trim();
    const quantity = quantityRaw ? Number(quantityRaw) : null;
    items.push({
      tenant_id: tenantId,
      delivery_note_id: deliveryNote.id,
      position: items.length + 1,
      description: itemDescription,
      quantity: quantity !== null && Number.isFinite(quantity) ? quantity : null,
      unit: String(itemUnits[i] ?? '').trim() || null,
    });
  }

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from('delivery_note_items').insert(items);
    if (itemsError) throw new Error(itemsError.message);
  }

  revalidatePath('/app/dokumentation');
}

export async function saveSubcontractorEntry(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'documentation.manage');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const dailyLogId = formData.get('daily_log_id') as string;
  if (!dailyLogId) throw new Error('Kein Tageseintrag ausgewählt');

  const companyName = formData.get('company_name') as string;
  if (!companyName) throw new Error('Firma ist erforderlich');

  const { error } = await supabase.from('subcontractor_entries').insert({
    tenant_id: tenantId,
    daily_log_id: dailyLogId,
    company_name: companyName,
    work_description: (formData.get('work_description') as string) || null,
    hours: Number(formData.get('hours') ?? 0),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/app/dokumentation');
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
  const { error } = await supabase.from('daily_assignments').upsert({
    tenant_id: tenantId,
    user_id: formData.get('user_id') as string,
    site_id: (formData.get('site_id') as string) || null,
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
    if (doc.file_url) await deletePrivateFile('site-documents', doc.file_url);
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

export async function saveSiteSuppliers(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const siteId = formData.get('site_id') as string;
  const names = formData.getAll('name[]');
  const contactPersons = formData.getAll('contact_person[]');
  const phones = formData.getAll('phone[]');
  const emails = formData.getAll('email[]');
  const notesList = formData.getAll('notes[]');
  const rowCount = names.length;

  for (let i = 0; i < rowCount; i++) {
    const name = String(names[i] ?? '').trim();
    if (!name) continue;
    const { error } = await supabase.from('site_suppliers').insert({
      tenant_id: tenantId,
      site_id: siteId,
      name,
      contact_person: String(contactPersons[i] ?? '').trim() || null,
      phone: String(phones[i] ?? '').trim() || null,
      email: String(emails[i] ?? '').trim() || null,
      notes: String(notesList[i] ?? '').trim() || null,
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

export async function updateSiteSupplier(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'sites.manage');
  const { tenantId } = ctx;

  const id = formData.get('id') as string;
  const siteId = formData.get('site_id') as string;
  const name = String(formData.get('name') ?? '').trim();
  if (!id || !siteId || !name) throw new Error('Pflichtfelder fehlen.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('site_suppliers')
    .update({
      name,
      contact_person: String(formData.get('contact_person') ?? '').trim() || null,
      phone: String(formData.get('phone') ?? '').trim() || null,
      email: String(formData.get('email') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
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

  await deletePrivateFile('site-documents', data.file_url);

  const { error } = await supabase.from('site_documents').delete().eq('id', id).eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);

  revalidatePath(`/app/baustellen/${data.site_id}`);
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
  await uploadPrivateFile('site-documents', path, file);

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

  const supabase = await createClient();
  const { error } = await supabase.from('company_holidays').delete().eq('id', formData.get('id') as string);
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

  const supabase = await createClient();
  const { error } = await supabase.from('bridge_days').delete().eq('id', formData.get('id') as string);
  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app/urlaub');
}

export async function updateLeaveEntitlement(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'team.leave_entitlement');
  const { tenantId } = ctx;

  const supabase = await createClient();
  const targetUserId = formData.get('user_id') as string;
  const year = Number(formData.get('year') ?? new Date().getFullYear());
  const entitlementDays = Number(formData.get('entitlement_days') ?? 30);

  const { error } = await supabase.from('leave_balances').upsert({
    tenant_id: tenantId,
    user_id: targetUserId,
    year,
    entitlement_days: entitlementDays,
  }, { onConflict: 'tenant_id,user_id,year' });
  if (error) throw new Error(error.message);
  revalidateEmployeePaths(targetUserId);
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
      revalidatePath('/app/team');
      return result;
    } catch (inviteError) {
      await admin.auth.admin.deleteUser(userId);
      throw inviteError;
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Mitarbeiter konnte nicht angelegt werden.',
    };
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
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Einladung konnte nicht erneuert werden.',
    };
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

  const profileUpdate = {
    first_name: formData.get('first_name') as string,
    last_name: formData.get('last_name') as string,
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
  };

  const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, { email });
  if (authError) throw new Error(authError.message);

  const { error } = await admin.from('profiles').update(profileUpdate).eq('id', targetUserId);
  if (error) throw new Error(error.message);

  revalidateEmployeePaths(targetUserId);
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
