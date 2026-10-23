import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getTenantIdForSession, requireTenantMember } from '@/lib/auth/session';
import { LeaveTabs } from '@/components/leave/leave-tabs';
import { LeaveTeamCalendarClient } from '@/components/leave/leave-team-calendar-client';
import { loadTeamLeaveCalendarData } from '@/lib/leave/load-team-calendar-data';

type PageProps = {
  searchParams: Promise<{ year?: string; month?: string }>;
};

export default async function UrlaubTeamCalendarPage({ searchParams }: PageProps) {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.urlaub')) return <p className="muted">Keine Berechtigung.</p>;

  if (!canAccess(ctx, 'urlaub.team_calendar')) {
    redirect('/app/urlaub/konto');
  }

  const tenantId = await getTenantIdForSession(ctx);
  if (!tenantId) return <p className="muted">Kein Mandant.</p>;

  const params = await searchParams;
  const supabase = await createClient();
  const data = await loadTeamLeaveCalendarData(supabase, tenantId, params.year, params.month);

  const canReview = canAccess(ctx, 'urlaub.approve');
  const canRequest = canAccess(ctx, 'urlaub.request');
  const canSeeOthersLeaveReason =
    canAccess(ctx, 'urlaub.approve') || canAccess(ctx, 'urlaub.view_all');

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>An- und Abwesenheit</h1>
          <p>Teamkalender – wer ist wann abwesend?</p>
        </div>
      </div>

      <LeaveTabs activeTab="teamkalender" showFreigabe={canReview} />

      <LeaveTeamCalendarClient
        data={data}
        canRequest={canRequest}
        viewer={{
          userId: ctx.userId,
          canSeeOthersLeaveReason,
        }}
      />
    </>
  );
}
