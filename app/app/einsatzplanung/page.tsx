import { SchedulePlanningLoader } from '@/components/schedule/schedule-planning-loader';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { loadSchedulePlanData } from '@/lib/schedule/load-plan-data';
import { mondayOfWeek, todayIsoInBerlin, weekDaysFromMonday } from '@/lib/schedule/week';
import { createClient } from '@/lib/supabase/server';

type PageProps = {
  searchParams: Promise<{ week?: string; view?: string; day?: string }>;
};

export default async function EinsatzplanungPage({ searchParams }: PageProps) {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.einsatzplanung')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const params = await searchParams;
  const weekStart = mondayOfWeek(params.week ?? todayIsoInBerlin());
  const view = params.view === 'day' ? 'day' : 'week';
  const weekDays = weekDaysFromMonday(weekStart);
  const today = todayIsoInBerlin();
  const requestedDay = params.day ?? today;
  // Der Tag muss in der angezeigten Woche liegen, sonst bleibt die Tagesansicht leer.
  const selectedDay = weekDays.includes(requestedDay)
    ? requestedDay
    : weekDays.includes(today)
      ? today
      : weekStart;

  const supabase = await createClient();
  const plan = await loadSchedulePlanData(supabase, ctx.tenant!.id, weekStart);

  return (
    <SchedulePlanningLoader
      plan={plan}
      canManage={canAccess(ctx, 'schedule.manage')}
      canPublish={canAccess(ctx, 'schedule.publish')}
      canShare={canAccess(ctx, 'schedule.share')}
      currentUserId={ctx.userId}
      selectedDay={selectedDay}
      view={view}
    />
  );
}
