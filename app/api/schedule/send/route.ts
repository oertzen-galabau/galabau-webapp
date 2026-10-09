import { NextResponse } from 'next/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { loadScheduleDayData, loadSchedulePlanData } from '@/lib/schedule/load-plan-data';
import { buildScheduleDayPdf, buildScheduleWeekPdf } from '@/lib/schedule/pdf';
import { formatGermanWeekdayDate, mondayOfWeek } from '@/lib/schedule/week';
import { sendMail, getDefaultMailRecipient, sendMailFailureText } from '@/lib/email/smtp';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { mode, date, week_start: weekStartParam, to, extraEmails } = body as {
    mode?: 'day' | 'week';
    date?: string;
    week_start?: string;
    to?: string;
    extraEmails?: string[];
  };

  let ctx;
  try {
    ctx = await getActionContext();
  } catch {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }
  if (!canAccess(ctx, 'schedule.share')) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: tenant } = await supabase.from('tenants').select('name').eq('id', ctx.tenantId).single();
  const tenantName = tenant?.name ?? 'Einsatzplan';

  const resolvedMode = mode ?? 'day';
  let bytes: Uint8Array;
  let subject: string;
  let filename: string;
  let textBody: string;

  if (resolvedMode === 'week') {
    const weekStart = mondayOfWeek(weekStartParam ?? date ?? new Date().toISOString().slice(0, 10));
    const plan = await loadSchedulePlanData(supabase, ctx.tenantId, weekStart);
    bytes = await buildScheduleWeekPdf({
      tenantName,
      weekStart: plan.weekStart,
      weekDays: plan.weekDays,
      entries: plan.entries,
    });
    subject = `Wochenplan ${weekStart} – ${tenantName}`;
    filename = `wochenplan-${weekStart}.pdf`;
    textBody = `Anbei der Wochenplan ab ${weekStart} für ${tenantName}.`;
  } else {
    const day = date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
    const dayData = await loadScheduleDayData(supabase, ctx.tenantId, day);
    bytes = await buildScheduleDayPdf({ tenantName, day, entries: dayData.entries });
    subject = `Einsatztafel ${formatGermanWeekdayDate(day)} – ${tenantName}`;
    filename = `einsatzplan-${day}.pdf`;
    textBody = `Anbei die Einsatztafel für ${formatGermanWeekdayDate(day)} (${tenantName}).`;
  }

  const recipients = new Set<string>();
  if (to?.trim()) recipients.add(to.trim());
  for (const e of extraEmails ?? []) {
    if (e?.trim()) recipients.add(e.trim());
  }
  if (!recipients.size) {
    const fallback = getDefaultMailRecipient();
    if (fallback) recipients.add(fallback);
  }
  if (!recipients.size) {
    return NextResponse.json({
      ok: true,
      simulated: true,
      message: 'Kein Empfänger angegeben und SMTP nicht konfiguriert.',
    });
  }

  const results = await Promise.all(
    [...recipients].map((recipient) =>
      sendMail({
        to: recipient,
        subject,
        text: textBody,
        attachments: [{ filename, content: Buffer.from(bytes), contentType: 'application/pdf' }],
      }),
    ),
  );

  const failed = results.find((r) => !r.ok);
  if (failed) {
    return NextResponse.json({ error: sendMailFailureText(failed) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: recipients.size });
}
