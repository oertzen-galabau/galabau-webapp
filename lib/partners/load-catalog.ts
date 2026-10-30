import type { SupabaseClient } from '@supabase/supabase-js';
import type { MasterPartnerCatalogEntry } from '@/lib/partners/catalog';
import type {
  BusinessPartnerKind,
  TenantBusinessPartner,
  TenantBusinessPartnerContact,
  TenantBusinessPartnerLocation,
} from '@/lib/types/database';

export async function loadPartnerCatalog(
  supabase: SupabaseClient,
  tenantId: string,
  kind: BusinessPartnerKind,
  options?: { activeOnly?: boolean },
): Promise<MasterPartnerCatalogEntry[]> {
  const activeOnly = options?.activeOnly ?? false;

  let partnersQuery = supabase
    .from('tenant_business_partners')
    .select('id, name, contact_person')
    .eq('tenant_id', tenantId)
    .eq('kind', kind)
    .order('name');
  if (activeOnly) partnersQuery = partnersQuery.eq('is_active', true);

  const [{ data: partners }, { data: locations }, { data: contacts }] = await Promise.all([
    partnersQuery,
    supabase
      .from('tenant_business_partner_locations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('label'),
    supabase
      .from('tenant_business_partner_contacts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name'),
  ]);

  const partnerIds = new Set((partners ?? []).map((row) => row.id));
  const locationsByPartner = new Map<string, TenantBusinessPartnerLocation[]>();
  const contactsByPartner = new Map<string, TenantBusinessPartnerContact[]>();

  for (const row of (locations ?? []) as TenantBusinessPartnerLocation[]) {
    if (!partnerIds.has(row.partner_id)) continue;
    const list = locationsByPartner.get(row.partner_id) ?? [];
    list.push(row);
    locationsByPartner.set(row.partner_id, list);
  }

  for (const row of (contacts ?? []) as TenantBusinessPartnerContact[]) {
    if (!partnerIds.has(row.partner_id)) continue;
    const list = contactsByPartner.get(row.partner_id) ?? [];
    list.push(row);
    contactsByPartner.set(row.partner_id, list);
  }

  return ((partners ?? []) as Pick<TenantBusinessPartner, 'id' | 'name' | 'contact_person'>[]).map((partner) => ({
    id: partner.id,
    name: partner.name,
    contact_person: partner.contact_person,
    locations: locationsByPartner.get(partner.id) ?? [],
    contacts: contactsByPartner.get(partner.id) ?? [],
  }));
}
