'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import type { BusinessPartnerKind } from '@/lib/types/database';
import { partnerKindFromTab, type PartnerTabId } from '@/lib/partners/kind';

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
  return tab === 'subunternehmer' ? '/app/geschaeftspartner' : '/app/geschaeftspartner?tab=lieferanten';
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
  const { error } = await supabase.from('tenant_business_partners').insert({
    tenant_id: tenantId,
    kind: kindRaw,
    ...fields,
    is_active: true,
  });
  if (error) throw new Error(error.message);

  const tab: PartnerTabId = kindRaw === 'supplier' ? 'lieferanten' : 'subunternehmer';
  revalidatePath(partnerListPath(tab));
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

  const tab: PartnerTabId = kindRaw === 'supplier' ? 'lieferanten' : 'subunternehmer';
  revalidatePath(partnerListPath(tab));
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

  const tab: PartnerTabId = kindRaw === 'supplier' ? 'lieferanten' : 'subunternehmer';
  revalidatePath(partnerListPath(tab));
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

  const { data: existing } = await supabase
    .from('site_suppliers')
    .select('id')
    .eq('site_id', siteId)
    .eq('tenant_id', tenantId)
    .eq('partner_id', partnerId)
    .maybeSingle();
  if (existing) throw new Error('Lieferant ist dieser Baustelle bereits zugeordnet');

  const { error } = await supabase.from('site_suppliers').insert({
    tenant_id: tenantId,
    site_id: siteId,
    partner_id: partner.id,
    name: partner.name,
    contact_person: partner.contact_person,
    phone: partner.phone,
    email: partner.email,
    notes: partner.notes,
  });
  if (error) throw new Error(error.message);

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
