import { InfoboardDashboard } from '@/components/infoboard/infoboard-dashboard';
import { fetchInfoboardPayload } from '@/lib/infoboard/fetch-dashboard-data';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';

export default async function DashboardPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.infoboard')) return <p className="muted">Keine Berechtigung.</p>;

  const supabase = await createClient();
  const payload = await fetchInfoboardPayload(ctx, supabase);

  return (
    <InfoboardDashboard
      initialLayout={payload.layout}
      widgetData={payload.widgetData}
      allowedWidgetIds={payload.allowedWidgetIds}
      canCustomize={payload.canCustomize}
    />
  );
}
