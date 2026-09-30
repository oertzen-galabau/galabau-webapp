import { NextResponse } from 'next/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail, getDefaultMailRecipient, sendMailFailureText } from '@/lib/email/smtp';
import {
  displayTitleForLog,
  parseDailyLogReportType,
  pdfFilenameStem,
} from '@/lib/documentation/report-labels';

export async function POST(request: Request) {
  const { reportId, to } = await request.json();

  let ctx;
  try {
    ctx = await getActionContext();
  } catch {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }
  if (!canAccess(ctx, 'reports.send')) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const { data: report } = await supabase
    .from('reports')
    .select('*, sites(name), tenants(name), daily_logs(report_type, custom_title)')
    .eq('id', reportId)
    .single();
  if (!report) return NextResponse.json({ error: 'Bericht nicht gefunden' }, { status: 404 });
  if (!report.pdf_url) return NextResponse.json({ error: 'Kein PDF für diesen Rapport vorhanden' }, { status: 400 });

  const recipient = (to as string) || getDefaultMailRecipient();
  if (!recipient) {
    return NextResponse.json({
      ok: true,
      simulated: true,
      message: 'Kein Empfänger angegeben und SMTP_TO/SMTP_FROM nicht gesetzt.',
    });
  }

  const admin = createAdminClient();
  const { data: file, error: downloadError } = await admin.storage.from('reports').download(report.pdf_url);
  if (downloadError || !file) {
    return NextResponse.json({ error: downloadError?.message ?? 'PDF konnte nicht geladen werden' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const siteName = (report.sites as { name: string } | { name: string }[] | null);
  const siteLabel = Array.isArray(siteName) ? siteName[0]?.name : siteName?.name;
  const tenantName = (report.tenants as { name: string } | { name: string }[] | null);
  const tenantLabel = Array.isArray(tenantName) ? tenantName[0]?.name : tenantName?.name;

  const dailyLogRaw = report.daily_logs as
    | { report_type: string; custom_title: string | null }
    | { report_type: string; custom_title: string | null }[]
    | null;
  const dailyLog = Array.isArray(dailyLogRaw) ? dailyLogRaw[0] : dailyLogRaw;
  const reportType = parseDailyLogReportType(dailyLog?.report_type);
  const docTitle = displayTitleForLog(reportType, dailyLog?.custom_title);
  const filename = `${pdfFilenameStem(reportType, dailyLog?.custom_title ?? null, report.report_date)}.pdf`;

  const result = await sendMail({
    to: recipient,
    subject: `${docTitle} ${report.report_date} · ${siteLabel ?? ''}`,
    text: `Anbei „${docTitle}“ vom ${report.report_date} für ${siteLabel ?? 'die Baustelle'} (${tenantLabel ?? ''}).`,
    replyTo: user.email ?? undefined,
    attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
  });

  if (!result.ok) {
    return NextResponse.json({
      ok: true,
      simulated: result.simulated,
      message: sendMailFailureText(result),
    });
  }

  await supabase.from('reports').update({
    status: 'sent',
    sent_to: recipient,
    sent_at: new Date().toISOString(),
  }).eq('id', reportId);

  return NextResponse.json({ ok: true, simulated: false });
}
