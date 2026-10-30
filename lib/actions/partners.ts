'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import type { BusinessPartnerKind } from '@/lib/types/database';
import { partnerKindFromTab, type PartnerTabId } from '@/lib/partners/kind';
import { partnerSettingsListPath } from '@/lib/partners/paths';

function requirePartnerManage(ctx: Awaited<ReturnType<typeof getActionContext>>) {
  if (!canAccess(ctx, 'partners.manage')) throw new Error('Keine Berechtigung');
}

function readPartnerFields(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Firma ist erforderlich');
  return {
    name,
    contact_person: String(formData.get('contact_person') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
  };
}

function partnerListPath(tab: PartnerTabId) {
  return partnerSettingsListPath(tab);
}

function readLocationFields(formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  if (!label) throw new Error('Bezeichnung des Standorts ist erforderlich');
  return {
    label,
    street: String(formData.get('street') ?? '').trim() || null,
    postal_code: String(formData.get('postal_code') ?? '').trim() || null,
    city: String(formData.get('city') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
  };
}

function readContactFields(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Name des Ansprechpartners ist erforderlich');
  const locationIdRaw = String(formData.get('location_id') ?? '').trim();
  return {
    name,
    role_title: String(formData.get('role_title') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    email: String(formData.get('email') ?? '').trim() || null,
    location_id: locationIdRaw || null,
  };
}

async function assertPartnerOwned(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  partnerId: string,
) {
  const { data, error } = await supabase
    .from('tenant_business_partners')
    .select('id, kind')
    .eq('id', partnerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Partner nicht gefunden');
  return data;
}

function revalidatePartnerTab(kind: BusinessPartnerKind) {
  const tab: PartnerTabId = kind === 'supplier' ? 'lieferanten' : 'subunternehmer';
  revalidatePath(partnerListPath(tab));
}

async function syncSiteSupplierContactLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  siteSupplierId: string,
  contactIds: string[],
) {
  const uniqueIds = [...new Set(contactIds.filter(Boolean))];
  const { error: deleteError } = await supabase
    .from('site_supplier_contacts')
    .delete()
    .eq('site_supplier_id', siteSupplierId)
    .eq('tenant_id', tenantId);
  if (deleteError) throw new Error(deleteError.message);

  if (uniqueIds.length === 0) return;

  const { error: insertError } = await supabase.from('site_supplier_contacts').insert(
    uniqueIds.map((partnerContactId) => ({
      tenant_id: tenantId,
      site_supplier_id: siteSupplierId,
      partner_contact_id: partnerContactId,
    })),
  );
  if (insertError) throw new Error(insertError.message);
}

async function validatePartnerLocationAndContacts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  partnerId: string,
  locationId: string | null,
  contactIds: string[],
) {
  if (locationId) {
    const { data: location, error } = await supabase
      .from('tenant_business_partner_locations')
      .select('id')
      .eq('id', locationId)
      .eq('tenant_id', tenantId)
      .eq('partner_id', partnerId)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!location) throw new Error('Standort gehört nicht zu diesem Lieferanten');
  }

  if (contactIds.length === 0) return [];

  const { data: contacts, error: contactsError } = await supabase
    .from('tenant_business_partner_contacts')
    .select('id, name, phone, email, location_id')
    .eq('tenant_id', tenantId)
    .eq('partner_id', partnerId)
    .eq('is_active', true)
    .in('id', contactIds);
  if (contactsError) throw new Error(contactsError.message);
  if ((contacts ?? []).length !== contactIds.length) {
    throw new Error('Mindestens ein Ansprechpartner ist ungültig');
  }

  for (const contact of contacts ?? []) {
    if (locationId && contact.location_id && contact.location_id !== locationId) {
      throw new Error('Ansprechpartner passt nicht zum gewählten Standort');
    }
  }

  return contacts ?? [];
}

function snapshotFromContacts(
  partner: { contact_person: string | null; phone: string | null; email: string | null },
  contacts: { name: string; phone: string | null; email: string | null }[],
) {
  const primary = contacts[0];
  if (!primary) {
    return {
      contact_person: partner.contact_person,
      phone: partner.phone,
      email: partner.email,
    };
  }
  return {
    contact_person: primary.name,
    phone: primary.phone,
    email: primary.email,
  };
}

export async function createPartner(formData: FormData) {
  const ctx = await getActionContext();
  requirePartnerManage(ctx);
  const { tenantId } = ctx;

  const kindRaw = formData.get('kind') as BusinessPartnerKind;
  if (kindRaw !== 'supplier' && kindRaw !== 'subcontractor') {
    throw new Error('Ungültiger Partnertyp');
  }

  const supabase = await createClient();
  const fields = readPartnerFields(formData);
  const { data: created, error } = await supabase
    .from('tenant_business_partners')
    .insert({
      tenant_id: tenantId,
      kind: kindRaw,
      ...fields,
      is_active: true,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  if (fields.contact_person || fields.phone || fields.email) {
    const { error: contactError } = await supabase.from('tenant_business_partner_contacts').insert({
      tenant_id: tenantId,
      partner_id: created.id,
      name: fields.contact_person || fields.name,
      phone: fields.phone,
      email: fields.email,
    });
    if (contactError) throw new Error(contactError.message);
  }

  revalidatePartnerTab(kindRaw);
}

export async function updatePartner(formData: FormData) {
  const ctx = await getActionContext();
  requirePartnerManage(ctx);
  const { tenantId } = ctx;

  const id = formData.get('id') as string;
  const kindRaw = formData.get('kind') as BusinessPartnerKind;
  if (!id) throw new Error('Partner fehlt');
  if (kindRaw !== 'supplier' && kindRaw !== 'subcontractor') {
    throw new Error('Ungültiger Partnertyp');
  }

  const supabase = await createClient();
  const fields = readPartnerFields(formData);
  const { error } = await supabase
    .from('tenant_business_partners')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('kind', kindRaw);
  if (error) throw new Error(error.message);

  revalidatePartnerTab(kindRaw);
}

export async function createPartnerLocation(formData: FormData) {
  const ctx = await getActionContext();
  requirePartnerManage(ctx);
  const { tenantId } = ctx;

  const partnerId = String(formData.get('partner_id') ?? '');
  const kindRaw = formData.get('kind') as BusinessPartnerKind;
  if (!partnerId) throw new Error('Partner fehlt');
  await assertPartnerOwned(await createClient(), tenantId, partnerId);

  const supabase = await createClient();
  const fields = readLocationFields(formData);
  const { error } = await supabase.from('tenant_business_partner_locations').insert({
    tenant_id: tenantId,
    partner_id: partnerId,
    ...fields,
    is_active: true,
  });
  if (error) throw new Error(error.message);
  revalidatePartnerTab(kindRaw);
}

export async function updatePartnerLocation(formData: FormData) {
  const ctx = await getActionContext();
  requirePartnerManage(ctx);
  const { tenantId } = ctx;

  const id = String(formData.get('id') ?? '');
  const partnerId = String(formData.get('partner_id') ?? '');
  const kindRaw = formData.get('kind') as BusinessPartnerKind;
  if (!id || !partnerId) throw new Error('Pflichtfelder fehlen');

  const supabase = await createClient();
  const fields = readLocationFields(formData);
  const { error } = await supabase
    .from('tenant_business_partner_locations')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('partner_id', partnerId)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePartnerTab(kindRaw);
}

export async function setPartnerLocationActive(formData: FormData) {
  const ctx = await getActionContext();
  requirePartnerManage(ctx);
  const { tenantId } = ctx;

  const id = String(formData.get('id') ?? '');
  const kindRaw = formData.get('kind') as BusinessPartnerKind;
  const isActive = formData.get('is_active') === 'true';
  if (!id) throw new Error('Standort fehlt');

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenant_business_partner_locations')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePartnerTab(kindRaw);
}

export async function createPartnerContact(formData: FormData) {
  const ctx = await getActionContext();
  requirePartnerManage(ctx);
  const { tenantId } = ctx;

  const partnerId = String(formData.get('partner_id') ?? '');
  const kindRaw = formData.get('kind') as BusinessPartnerKind;
  if (!partnerId) throw new Error('Partner fehlt');

  const supabase = await createClient();
  await assertPartnerOwned(supabase, tenantId, partnerId);
  const fields = readContactFields(formData);

  if (fields.location_id) {
    const { data: location } = await supabase
      .from('tenant_business_partner_locations')
      .select('id')
      .eq('id', fields.location_id)
      .eq('partner_id', partnerId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!location) throw new Error('Standort gehört nicht zu diesem Partner');
  }

  const { error } = await supabase.from('tenant_business_partner_contacts').insert({
    tenant_id: tenantId,
    partner_id: partnerId,
    ...fields,
    is_active: true,
  });
  if (error) throw new Error(error.message);
  revalidatePartnerTab(kindRaw);
}

export async function updatePartnerContact(formData: FormData) {
  const ctx = await getActionContext();
  requirePartnerManage(ctx);
  const { tenantId } = ctx;

  const id = String(formData.get('id') ?? '');
  const partnerId = String(formData.get('partner_id') ?? '');
  const kindRaw = formData.get('kind') as BusinessPartnerKind;
  if (!id || !partnerId) throw new Error('Pflichtfelder fehlen');

  const supabase = await createClient();
  const fields = readContactFields(formData);

  if (fields.location_id) {
    const { data: location } = await supabase
      .from('tenant_business_partner_locations')
      .select('id')
      .eq('id', fields.location_id)
      .eq('partner_id', partnerId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!location) throw new Error('Standort gehört nicht zu diesem Partner');
  }

  const { error } = await supabase
    .from('tenant_business_partner_contacts')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('partner_id', partnerId)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePartnerTab(kindRaw);
}

export async function setPartnerContactActive(formData: FormData) {
  const ctx = await getActionContext();
  requirePartnerManage(ctx);
  const { tenantId } = ctx;

  const id = String(formData.get('id') ?? '');
  const kindRaw = formData.get('kind') as BusinessPartnerKind;
  const isActive = formData.get('is_active') === 'true';
  if (!id) throw new Error('Ansprechpartner fehlt');

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenant_business_partner_contacts')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePartnerTab(kindRaw);
}

export async function setPartnerActive(formData: FormData) {
  const ctx = await getActionContext();
  requirePartnerManage(ctx);
  const { tenantId } = ctx;

  const id = formData.get('id') as string;
  const kindRaw = formData.get('kind') as BusinessPartnerKind;
  const isActive = formData.get('is_active') === 'true';
  if (!id) throw new Error('Partner fehlt');

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenant_business_partners')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('kind', kindRaw);
  if (error) throw new Error(error.message);

  revalidatePartnerTab(kindRaw);
}

export async function linkSiteSupplier(formData: FormData) {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'sites.manage')) throw new Error('Keine Berechtigung');
  const { tenantId } = ctx;

  const siteId = formData.get('site_id') as string;
  const partnerId = formData.get('partner_id') as string;
  if (!siteId || !partnerId) throw new Error('Baustelle und Lieferant sind erforderlich');

  const supabase = await createClient();
  const { data: partner, error: partnerError } = await supabase
    .from('tenant_business_partners')
    .select('*')
    .eq('id', partnerId)
    .eq('tenant_id', tenantId)
    .eq('kind', 'supplier')
    .eq('is_active', true)
    .maybeSingle();
  if (partnerError) throw new Error(partnerError.message);
  if (!partner) throw new Error('Lieferant nicht gefunden');

  const { assertSiteInTenant } = await import('@/lib/tenant/row-access');
  await assertSiteInTenant(supabase, tenantId, siteId);

  const locationIdRaw = String(formData.get('partner_location_id') ?? '').trim();
  const partnerLocationId = locationIdRaw || null;
  const contactIds = formData.getAll('partner_contact_id[]').map(String).filter(Boolean);

  const contacts = await validatePartnerLocationAndContacts(
    supabase,
    tenantId,
    partnerId,
    partnerLocationId,
    contactIds,
  );

  let existingQuery = supabase
    .from('site_suppliers')
    .select('id')
    .eq('site_id', siteId)
    .eq('tenant_id', tenantId)
    .eq('partner_id', partnerId);
  existingQuery = partnerLocationId
    ? existingQuery.eq('partner_location_id', partnerLocationId)
    : existingQuery.is('partner_location_id', null);
  const { data: existing } = await existingQuery.maybeSingle();
  if (existing) {
    throw new Error('Diese Lieferanten-Kombination ist der Baustelle bereits zugeordnet');
  }

  const snapshot = snapshotFromContacts(partner, contacts);

  const { data: inserted, error } = await supabase
    .from('site_suppliers')
    .insert({
      tenant_id: tenantId,
      site_id: siteId,
      partner_id: partner.id,
      partner_location_id: partnerLocationId,
      name: partner.name,
      contact_person: snapshot.contact_person,
      phone: snapshot.phone,
      email: snapshot.email,
      notes: partner.notes,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  await syncSiteSupplierContactLinks(supabase, tenantId, inserted.id, contactIds);

  revalidatePath(`/app/baustellen/${siteId}`);
}

export async function updateSiteSupplierAssignment(formData: FormData) {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'sites.manage')) throw new Error('Keine Berechtigung');
  const { tenantId } = ctx;

  const id = formData.get('id') as string;
  const siteId = formData.get('site_id') as string;
  const partnerId = formData.get('partner_id') as string;
  if (!id || !siteId || !partnerId) throw new Error('Pflichtfelder fehlen');

  const supabase = await createClient();
  const locationIdRaw = String(formData.get('partner_location_id') ?? '').trim();
  const partnerLocationId = locationIdRaw || null;
  const contactIds = formData.getAll('partner_contact_id[]').map(String).filter(Boolean);

  const contacts = await validatePartnerLocationAndContacts(
    supabase,
    tenantId,
    partnerId,
    partnerLocationId,
    contactIds,
  );

  const { data: partner, error: partnerError } = await supabase
    .from('tenant_business_partners')
    .select('contact_person, phone, email')
    .eq('id', partnerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (partnerError) throw new Error(partnerError.message);
  if (!partner) throw new Error('Lieferant nicht gefunden');

  const snapshot = snapshotFromContacts(partner, contacts);

  const { error } = await supabase
    .from('site_suppliers')
    .update({
      partner_location_id: partnerLocationId,
      contact_person: snapshot.contact_person,
      phone: snapshot.phone,
      email: snapshot.email,
    })
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);

  await syncSiteSupplierContactLinks(supabase, tenantId, id, contactIds);

  revalidatePath(`/app/baustellen/${siteId}`);
}

export async function updateSiteSupplierNotes(formData: FormData) {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'sites.manage')) throw new Error('Keine Berechtigung');
  const { tenantId } = ctx;

  const id = formData.get('id') as string;
  const siteId = formData.get('site_id') as string;
  if (!id || !siteId) throw new Error('Pflichtfelder fehlen');

  const supabase = await createClient();
  const { error } = await supabase
    .from('site_suppliers')
    .update({
      notes: String(formData.get('notes') ?? '').trim() || null,
    })
    .eq('id', id)
    .eq('site_id', siteId)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/baustellen/${siteId}`);
}

export async function resolvePartnerName(
  tenantId: string,
  partnerId: string | null,
  freeText: string | null,
  kind: BusinessPartnerKind,
): Promise<{ partnerId: string | null; displayName: string }> {
  const trimmed = String(freeText ?? '').trim();
  if (!partnerId) {
    if (!trimmed) throw new Error('Firma ist erforderlich');
    return { partnerId: null, displayName: trimmed };
  }

  const supabase = await createClient();
  const { data: partner, error } = await supabase
    .from('tenant_business_partners')
    .select('id, name, kind, is_active')
    .eq('id', partnerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!partner || partner.kind !== kind) throw new Error('Ungültiger Eintrag aus der Stammliste');
  if (!partner.is_active && !trimmed) {
    throw new Error('Der gewählte Stammeintrag ist inaktiv — bitte Freitext oder anderen Eintrag wählen');
  }

  return {
    partnerId: partner.id,
    displayName: trimmed || partner.name,
  };
}

export { partnerKindFromTab };
