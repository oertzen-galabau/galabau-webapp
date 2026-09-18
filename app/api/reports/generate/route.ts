import { NextResponse } from 'next/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildReportPdf, type ReportPhotoInput } from '@/lib/reports/pdf';
import { buildStoragePath } from '@/lib/supabase/storage';

export async function POST(request: Request) {
  const { dailyLogId } = await request.json();

  let ctx;
  try {
    ctx = await getActionContext();
  } catch {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }
  if (!canAccess(ctx, 'reports.generate')) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const { data: log } = await supabase.from('daily_logs').select('*, sites(name)').eq('id', dailyLogId).single();
  if (!log) return NextResponse.json({ error: 'Tageseintrag nicht gefunden' }, { status: 404 });

  const { data: tenant } = await supabase.from('tenants').select('name').eq('id', log.tenant_id).single();

  const [
    { data: workItems },
    { data: equipment },
    { data: subcontractors },
    { data: photos },
    { data: deliveries },
  ] = await Promise.all([
    supabase.from('daily_log_work').select('*').eq('daily_log_id', dailyLogId),
    supabase.from('equipment_hours').select('*').eq('daily_log_id', dailyLogId),
    supabase.from('subcontractor_entries').select('*').eq('daily_log_id', dailyLogId).is('deleted_at', null),
    supabase.from('daily_log_photos').select('*').eq('daily_log_id', dailyLogId).is('deleted_at', null),
    supabase.from('delivery_notes').select('*').eq('daily_log_id', dailyLogId).is('deleted_at', null),
  ]);

  const admin = createAdminClient();

  const photoInputs: ReportPhotoInput[] = [];
  for (const photo of photos ?? []) {
    if (!photo.file_url) continue;
    const { data: file } = await admin.storage.from('daily-photos').download(photo.file_url);
    if (!file) continue;
    const bytes = new Uint8Array(await file.arrayBuffer());
    photoInputs.push({ bytes, contentType: file.type, caption: photo.caption ?? null });
  }

  const siteName = (log.sites as { name: string }[] | null)?.[0]?.name ?? 'Baustelle';

  const pdfBytes = await buildReportPdf({
    tenantName: tenant?.name ?? 'Unternehmen',
    siteName,
    reportDate: log.log_date,
    weather: log.weather,
    notes: log.notes,
    workItems: workItems ?? [],
    equipment: equipment ?? [],
    subcontractors: subcontractors ?? [],
    deliveries: deliveries ?? [],
    photos: photoInputs,
  });

  const path = buildStoragePath(log.tenant_id, log.site_id, `${log.log_date}.pdf`);

  const { error: uploadError } = await admin.storage
    .from('reports')
    .upload(path, pdfBytes, { upsert: true, contentType: 'application/pdf' });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: report, error } = await supabase.from('reports').upsert({
    tenant_id: log.tenant_id,
    site_id: log.site_id,
    daily_log_id: log.id,
    report_date: log.log_date,
    status: 'final',
    pdf_url: path,
    created_by: user.id,
  }, { onConflict: 'daily_log_id' }).select('*').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ report });
}
