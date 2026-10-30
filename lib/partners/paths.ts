import type { PartnerTabId } from '@/lib/partners/kind';

export function partnerSettingsListPath(partnerTab: PartnerTabId = 'subunternehmer') {
  const base = '/app/einstellungen?tab=stammdaten';
  if (partnerTab === 'lieferanten') return `${base}&partners=lieferanten`;
  if (partnerTab === 'fahrzeuge') return `${base}&partners=fahrzeuge`;
  if (partnerTab === 'ansprechpartner') return `${base}&partners=ansprechpartner`;
  return base;
}
