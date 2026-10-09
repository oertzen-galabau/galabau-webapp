import { NextResponse } from 'next/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildReportPdf, type ReportPhotoInput, type ReportSignatureInput } from '@/lib/reports/pdf';
import { buildStoragePath } from '@/lib/supabase/storage';
import { assertStoragePathBelongsToTenant } from '@/lib/tenant/row-access';
import { parseDailyLogReportType, tenantReportLabelsFromTenant } from '@/lib/documentation/report-labels';
import { userCanViewDailyLog } from '@/lib/documentation/report-access';

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

  const { data: log } = await supabase
    .from('daily_logs')
    .select('*, sites(name, client_name, address)')
    .eq('id', dailyLogId)
    .single();
  if (!log) return NextResponse.json({ error: 'Tageseintrag nicht gefunden' }, { status: 404 });
  if (log.tenant_id !== ctx.tenantId) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }
  if (!userCanViewDailyLog(ctx, { created_by: log.created_by as string | null })) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, daily_report_label, hourly_wage_rapport_label')
    .eq('id', log.tenant_id)
    .single();
  const reportLabels = tenantReportLabelsFromTenant(tenant);

  const [
    { data: workers },
    { data: workItems },
    { data: resources },
    { data: subcontractors },
    { data: photos },
    { data: deliveries },
    { data: signatures },
  ] = await Promise.all([
    supabase.from('daily_log_worker_hours').select('*').eq('daily_log_id', dailyLogId),
    supabase.from('daily_log_work').select('*').eq('daily_log_id', dailyLogId),
    supabase.from('equipment_hours').select('*').eq('daily_log_id', dailyLogId),
    supabase.from('subcontractor_entries').select('*').eq('daily_log_id', dailyLogId).is('deleted_at', null),
    supabase.from('daily_log_photos').select('*').eq('daily_log_id', dailyLogId).is('deleted_at', null),
    supabase.from('delivery_notes').select('*').eq('daily_log_id', dailyLogId).is('deleted_at', null),
    supabase.from('daily_log_signatures').select('*').eq('daily_log_id', dailyLogId),
  ]);

  const deliveryIds = (deliveries ?? []).map((entry) => entry.id);
  const { data: deliveryItems } = deliveryIds.length
    ? await supabase.from('delivery_note_items').select('*').in('delivery_note_id', deliveryIds).order('position')
    : { data: [] };

  type DeliveryItemRow = NonNullable<typeof deliveryItems>[number];
  const itemsByDelivery = new Map<string, DeliveryItemRow[]>();
  for (const item of deliveryItems ?? []) {
    const list = itemsByDelivery.get(item.delivery_note_id) ?? [];
    list.push(item);
    itemsByDelivery.set(item.delivery_note_id, list);
  }

  const admin = createAdminClient();

  const photoInputs: ReportPhotoInput[] = [];
  for (const photo of photos ?? []) {
    if (!photo.file_url) continue;
    assertStoragePathBelongsToTenant(ctx.tenantId, photo.file_url);
    const { data: file } = await admin.storage.from('daily-photos').download(photo.file_url);
    if (!file) continue;
    const bytes = new Uint8Array(await file.arrayBuffer());
    photoInputs.push({ bytes, contentType: file.type, caption: photo.caption ?? null });
  }

  const signatureInputs: ReportSignatureInput[] = [];
  for (const signature of signatures ?? []) {
    if (!signature.file_url) continue;
    assertStoragePathBelongsToTenant(ctx.tenantId, signature.file_url);
    const { data: file } = await admin.storage.from('daily-photos').download(signature.file_url);
    if (!file) continue;
    signatureInputs.push({
      role: signature.role as 'contractor' | 'client',
      signerName: signature.signer_name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
      signedAt: signature.signed_at,
      signedLocationLabel: signature.signed_location_label,
      signedLatitude: signature.signed_latitude,
      signedLongitude: signature.signed_longitude,
    });
  }

  const site = log.sites as { name: string; client_name: string | null; address: string | null } | null;

  const pdfBytes = await buildReportPdf({
    tenantName: tenant?.name ?? 'Unternehmen',
    clientName: site?.client_name ?? null,
    siteName: site?.name ?? 'Baustelle',
    siteAddress: site?.address ?? null,
    reportDate: log.log_date,
    reportType: parseDailyLogReportType(log.report_type as string),
    customTitle: log.custom_title as string | null,
    reportLabels,
    weather: log.weather,
    notes: log.notes,
    workers: (workers ?? []).map((row) => ({
      worker_name: row.worker_name,
      job_title: row.job_title,
      hours: Number(row.hours),
    })),
    workItems: (workItems ?? []).map((row) => ({
      description: row.description,
      quantity: row.quantity != null ? Number(row.quantity) : null,
      unit: row.unit,
    })),
    resources: (resources ?? []).map((row) => ({
      equipment_name: row.equipment_name,
      quantity: row.quantity != null ? Number(row.quantity) : null,
      unit: row.unit,
      hours: Number(row.hours),
    })),
    subcontractors: subcontractors ?? [],
    deliveries: (deliveries ?? []).map((entry) => ({
      supplier_name: entry.supplier_name,
      description: entry.description,
      items: (itemsByDelivery.get(entry.id) ?? []).map((item) => ({
        description: item.description,
        quantity: item.quantity != null ? Number(item.quantity) : null,
        unit: item.unit,
      })),
    })),
    photos: photoInputs,
    signatures: signatureInputs,
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
