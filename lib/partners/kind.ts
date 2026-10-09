import type { BusinessPartnerKind } from '@/lib/types/database';

export type PartnerTabId = 'subunternehmer' | 'lieferanten' | 'fahrzeuge';

export const PARTNER_TAB_LABELS: Record<PartnerTabId, string> = {
  subunternehmer: 'Subunternehmer',
  lieferanten: 'Lieferanten',
  fahrzeuge: 'Fahrzeuge & Geräte',
};

export function partnerKindFromTab(tab: PartnerTabId): BusinessPartnerKind {
  return tab === 'lieferanten' ? 'supplier' : 'subcontractor';
}

export function isPartnerTab(value: string | undefined): value is PartnerTabId {
  return value === 'subunternehmer' || value === 'lieferanten' || value === 'fahrzeuge';
}

export function isBusinessPartnerTab(tab: PartnerTabId): tab is 'subunternehmer' | 'lieferanten' {
  return tab === 'subunternehmer' || tab === 'lieferanten';
}

export function partnerOptionLabel(partner: {
  name: string;
  contact_person: string | null;
}): string {
  if (partner.contact_person) {
    return `${partner.name} (${partner.contact_person})`;
  }
  return partner.name;
}
