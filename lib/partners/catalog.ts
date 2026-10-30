import type { TenantBusinessPartnerContact, TenantBusinessPartnerLocation } from '@/lib/types/database';

export type MasterPartnerCatalogEntry = {
  id: string;
  name: string;
  contact_person: string | null;
  locations: TenantBusinessPartnerLocation[];
  contacts: TenantBusinessPartnerContact[];
};

export function contactsForPartnerSelection(
  contacts: TenantBusinessPartnerContact[],
  locationId: string | null,
): TenantBusinessPartnerContact[] {
  const active = contacts.filter((row) => row.is_active);
  if (!locationId) return active;
  return active.filter((row) => !row.location_id || row.location_id === locationId);
}

export function siteSupplierLinkKey(partnerId: string, locationId: string | null): string {
  return `${partnerId}:${locationId ?? ''}`;
}
