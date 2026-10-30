import type { TenantBusinessPartnerContact, TenantBusinessPartnerLocation } from '@/lib/types/database';

export function partnerLocationLabel(location: Pick<TenantBusinessPartnerLocation, 'label' | 'city'>): string {
  if (location.city?.trim()) {
    return `${location.label} (${location.city.trim()})`;
  }
  return location.label;
}

export function partnerLocationAddress(
  location: Pick<TenantBusinessPartnerLocation, 'street' | 'postal_code' | 'city'>,
): string | null {
  const parts = [
    location.street?.trim(),
    [location.postal_code?.trim(), location.city?.trim()].filter(Boolean).join(' '),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

export function partnerContactLabel(
  contact: Pick<TenantBusinessPartnerContact, 'name' | 'role_title'>,
): string {
  if (contact.role_title?.trim()) {
    return `${contact.name} (${contact.role_title.trim()})`;
  }
  return contact.name;
}
