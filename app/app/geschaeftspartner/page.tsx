import { redirect } from 'next/navigation';
import { isPartnerTab } from '@/lib/partners/kind';
import { partnerSettingsListPath } from '@/lib/partners/paths';

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

/** Alte URL — Weiterleitung zu Einstellungen → Stammdaten */
export default async function GeschaeftspartnerRedirectPage({ searchParams }: PageProps) {
  const { tab: tabParam } = await searchParams;
  const partnerTab = isPartnerTab(tabParam) ? tabParam : 'subunternehmer';
  redirect(partnerSettingsListPath(partnerTab));
}
