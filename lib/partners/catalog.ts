import { partnerLocationLabel } from '@/lib/partners/labels';
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

export type SiteSupplierLinkOption = {
  value: string;
  label: string;
};

/** Wert für Formular: `partnerId|locationId` (leerer Standort = nur Lieferant). */
export function encodeSiteSupplierLinkValue(partnerId: string, locationId: string | null): string {
  return `${partnerId}|${locationId ?? ''}`;
}

export function decodeSiteSupplierLinkValue(raw: string): { partnerId: string; locationId: string | null } {
  const [partnerId, locationId = ''] = raw.split('|');
  if (!partnerId) throw new Error('Ungültige Lieferanten-Auswahl');
  return { partnerId, locationId: locationId.trim() || null };
}

export function buildAvailableSiteSupplierLinks(
  catalog: MasterPartnerCatalogEntry[],
  linkedKeys: string[],
): SiteSupplierLinkOption[] {
  const options: SiteSupplierLinkOption[] = [];

  for (const entry of catalog) {
    const withoutLocationKey = siteSupplierLinkKey(entry.id, null);
    if (!linkedKeys.includes(withoutLocationKey)) {
      options.push({
        value: encodeSiteSupplierLinkValue(entry.id, null),
        label: entry.name,
      });
    }

    for (const location of (entry.locations ?? []).filter((row) => row.is_active)) {
      const key = siteSupplierLinkKey(entry.id, location.id);
      if (!linkedKeys.includes(key)) {
        options.push({
          value: encodeSiteSupplierLinkValue(entry.id, location.id),
          label: `${entry.name} · ${partnerLocationLabel(location)}`,
        });
      }
    }
  }

  return options.sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
}
