import { NextResponse } from 'next/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { loadScheduleDayData, loadSchedulePlanData } from '@/lib/schedule/load-plan-data';
import { buildScheduleDayPdf, buildScheduleWeekPdf } from '@/lib/schedule/pdf';
import { mondayOfWeek } from '@/lib/schedule/week';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await getActionContext();
  } catch {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }
  if (!canAccess(ctx, 'schedule.view')) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') ?? 'day';
  const date = url.searchParams.get('date');
  const weekStartParam = url.searchParams.get('week_start');
  const dispositionParam = url.searchParams.get('disposition');
  const disposition = dispositionParam === 'inline' ? 'inline' : 'attachment';

  const supabase = await createClient();
  const { data: tenant } = await supabase.from('tenants').select('name').eq('id', ctx.tenantId).single();
  const tenantName = tenant?.name ?? 'Einsatzplan';

  let bytes: Uint8Array;
  let filename: string;

  if (mode === 'week') {
    const weekStart = mondayOfWeek(weekStartParam ?? date ?? new Date().toISOString().slice(0, 10));
    const plan = await loadSchedulePlanData(supabase, ctx.tenantId, weekStart);
    if (!canAccess(ctx, 'schedule.manage') && !plan.published) {
      return NextResponse.json({ error: 'Woche noch nicht vollständig veröffentlicht' }, { status: 403 });
    }
    bytes = await buildScheduleWeekPdf({
      tenantName,
      weekStart: plan.weekStart,
      weekDays: plan.weekDays,
      entries: plan.entries,
    });
    filename = `wochenplan-${plan.weekStart}.pdf`;
  } else {
    const day = date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
    const weekStart = mondayOfWeek(day);
    const plan = await loadSchedulePlanData(supabase, ctx.tenantId, weekStart);
    const dayPublished = plan.publishedByDay[day] ?? false;
    if (!canAccess(ctx, 'schedule.manage') && !dayPublished) {
      return NextResponse.json({ error: 'Tag noch nicht veröffentlicht' }, { status: 403 });
    }
    const dayData = await loadScheduleDayData(supabase, ctx.tenantId, day);
    const employeeNames: Record<string, string> = {};
    for (const e of plan.employees) {
      employeeNames[e.id] = `${e.first_name} ${e.last_name}`.trim();
    }
    bytes = await buildScheduleDayPdf({
      tenantName,
      day,
      entries: dayData.entries,
      draft: canAccess(ctx, 'schedule.manage') && !dayPublished,
      absentees: plan.leaveDays,
      employeeNames,
    });
    filename = `einsatzplan-${day}.pdf`;
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${filename}"`,
    },
  });
}
