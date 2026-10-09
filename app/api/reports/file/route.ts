import { NextResponse } from 'next/server';
import { getActionContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertStoragePathBelongsToTenant } from '@/lib/tenant/row-access';
import { requireSiteAccess } from '@/lib/sites/access';
import { userCanViewReport } from '@/lib/documentation/report-access';
import {
  parseDailyLogReportType,
  pdfFilenameStem,
  tenantReportLabelsFromTenant,
} from '@/lib/documentation/report-labels';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get('reportId')?.trim();
  const dispositionParam = searchParams.get('disposition');
  const disposition = dispositionParam === 'attachment' ? 'attachment' : 'inline';

  if (!reportId) {
    return NextResponse.json({ error: 'reportId fehlt' }, { status: 400 });
  }

  let ctx;
  try {
    ctx = await getActionContext();
  } catch {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: report } = await supabase
    .from('reports')
    .select(
      'id, tenant_id, site_id, report_date, pdf_url, created_by, daily_logs(report_type, custom_title, created_by), tenants(daily_report_label, hourly_wage_rapport_label)',
    )
    .eq('id', reportId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();

  if (!report?.pdf_url) {
    return NextResponse.json({ error: 'Bericht nicht gefunden' }, { status: 404 });
  }

  const dailyLogRaw = report.daily_logs as
    | { report_type: string; custom_title: string | null; created_by: string | null }
    | { report_type: string; custom_title: string | null; created_by: string | null }[]
    | null;
  const dailyLog = Array.isArray(dailyLogRaw) ? dailyLogRaw[0] : dailyLogRaw;

  if (
    !userCanViewReport(ctx, {
      created_by: report.created_by as string | null,
      daily_log: dailyLog ? { created_by: dailyLog.created_by } : null,
    })
  ) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  try {
    await requireSiteAccess(supabase, ctx, report.site_id);
  } catch {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  assertStoragePathBelongsToTenant(ctx.tenantId, report.pdf_url);
  const admin = createAdminClient();
  const { data: file, error: downloadError } = await admin.storage.from('reports').download(report.pdf_url);
  if (downloadError || !file) {
    return NextResponse.json({ error: downloadError?.message ?? 'PDF konnte nicht geladen werden' }, { status: 400 });
  }

  const tenantRaw = report.tenants as
    | { daily_report_label: string | null; hourly_wage_rapport_label: string | null }
    | { daily_report_label: string | null; hourly_wage_rapport_label: string | null }[]
    | null;
  const tenantRow = Array.isArray(tenantRaw) ? tenantRaw[0] : tenantRaw;
  const reportLabels = tenantReportLabelsFromTenant(tenantRow);
  const reportType = parseDailyLogReportType(dailyLog?.report_type);
  const filename = `${pdfFilenameStem(reportType, dailyLog?.custom_title ?? null, report.report_date, reportLabels)}.pdf`;

  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `${disposition}; filename="${filename.replace(/"/g, '')}"`,
    'Cache-Control': 'private, no-store',
  });

  return new NextResponse(file.stream(), { status: 200, headers });
}
