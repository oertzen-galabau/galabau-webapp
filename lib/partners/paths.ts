import type { PartnerTabId } from '@/lib/partners/kind';

export function partnerSettingsListPath(partnerTab: PartnerTabId = 'subunternehmer') {
  const base = '/app/einstellungen?tab=stammdaten';
  return partnerTab === 'lieferanten' ? `${base}&partners=lieferanten` : base;
}
