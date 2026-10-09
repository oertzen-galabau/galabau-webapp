import { NextResponse } from 'next/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail, getDefaultMailRecipient, sendMailFailureText } from '@/lib/email/smtp';
import { assertStoragePathBelongsToTenant } from '@/lib/tenant/row-access';
import {
  displayTitleForLog,
  parseDailyLogReportType,
  pdfFilenameStem,
  tenantReportLabelsFromTenant,
} from '@/lib/documentation/report-labels';
import { userCanViewReport } from '@/lib/documentation/report-access';
import { requireSiteAccess } from '@/lib/sites/access';

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
    .select('*, sites(name), tenants(name, daily_report_label, hourly_wage_rapport_label), daily_logs(report_type, custom_title, created_by)')
    .eq('id', reportId)
    .eq('tenant_id', ctx.tenantId)
    .single();
  if (!report) return NextResponse.json({ error: 'Bericht nicht gefunden' }, { status: 404 });
  if (!report.pdf_url) return NextResponse.json({ error: 'Kein PDF für diesen Rapport vorhanden' }, { status: 400 });

  const dailyLogForAccess = report.daily_logs as
    | { report_type: string; custom_title: string | null; created_by: string | null }
    | { report_type: string; custom_title: string | null; created_by: string | null }[]
    | null;
  const dailyLogAccessRow = Array.isArray(dailyLogForAccess) ? dailyLogForAccess[0] : dailyLogForAccess;
  if (
    !userCanViewReport(ctx, {
      created_by: report.created_by as string | null,
      daily_log: dailyLogAccessRow ? { created_by: dailyLogAccessRow.created_by } : null,
    })
  ) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }
  try {
    await requireSiteAccess(supabase, ctx, report.site_id);
  } catch {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  const recipient = (to as string) || getDefaultMailRecipient();
  if (!recipient) {
    return NextResponse.json({
      ok: true,
      simulated: true,
      message: 'Kein Empfänger angegeben und SMTP_TO/SMTP_FROM nicht gesetzt.',
    });
  }

  assertStoragePathBelongsToTenant(ctx.tenantId, report.pdf_url);
  const admin = createAdminClient();
  const { data: file, error: downloadError } = await admin.storage.from('reports').download(report.pdf_url);
  if (downloadError || !file) {
    return NextResponse.json({ error: downloadError?.message ?? 'PDF konnte nicht geladen werden' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const siteName = (report.sites as { name: string } | { name: string }[] | null);
  const siteLabel = Array.isArray(siteName) ? siteName[0]?.name : siteName?.name;
  const tenantRaw = report.tenants as
    | { name: string; daily_report_label: string | null; hourly_wage_rapport_label: string | null }
    | { name: string; daily_report_label: string | null; hourly_wage_rapport_label: string | null }[]
    | null;
  const tenantRow = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;
  const tenantLabel = tenantRow?.name;
  const reportLabels = tenantReportLabelsFromTenant(tenantRow);

  const dailyLogRaw = report.daily_logs as
    | { report_type: string; custom_title: string | null }
    | { report_type: string; custom_title: string | null }[]
    | null;
  const dailyLog = Array.isArray(dailyLogRaw) ? dailyLogRaw[0] : dailyLogRaw;
  const reportType = parseDailyLogReportType(dailyLog?.report_type);
  const docTitle = displayTitleForLog(reportType, dailyLog?.custom_title, reportLabels);
  const filename = `${pdfFilenameStem(reportType, dailyLog?.custom_title ?? null, report.report_date, reportLabels)}.pdf`;

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
  }).eq('id', reportId).eq('tenant_id', ctx.tenantId);

  return NextResponse.json({ ok: true, simulated: false });
}
