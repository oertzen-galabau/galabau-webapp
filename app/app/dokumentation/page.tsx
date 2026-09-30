import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireTenantMember } from '@/lib/auth/session';
import { saveDeliveryNote, saveSubcontractorEntry } from '@/lib/actions/admin';
import { canAccess } from '@/lib/auth/session';
import { DailyLogEntriesList } from '@/components/documentation/daily-log-entries-list';
import { DailyReportForm, type DailyReportFormInitial } from '@/components/documentation/daily-report-form';
import { DeliveryNoteScanForm } from '@/components/documentation/delivery-note-scan-form';
import { isDictationConfigured } from '@/lib/ai/daily-log-dictation';
import { getSignedFileUrls } from '@/lib/supabase/storage';
import { fetchAccessibleSites } from '@/lib/sites/access';
import {
  isDailyLogReportType,
  parseDailyLogReportType,
  type DailyLogReportType,
} from '@/lib/documentation/report-labels';
type PageProps = {
  searchParams: Promise<{ edit?: string; site?: string; type?: string; art?: string }>;
};

export default async function DokumentationPage({ searchParams }: PageProps) {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.dokumentation')) {
    return <p className="muted">Keine Berechtigung für die Baustellendokumentation.</p>;
  }

  const { edit: editLogId, site: preselectedSiteId, type: preselectedType, art: artFilter } =
    await searchParams;
  const defaultReportType: DailyLogReportType =
    preselectedType && isDailyLogReportType(preselectedType)
      ? preselectedType
      : 'hourly_wage_rapport';
  const listArtFilter = artFilter === 'daily_report' || artFilter === 'hourly_wage_rapport' ? artFilter : null;
  const canManage = canAccess(ctx, 'documentation.manage');
  const canDictate = canAccess(ctx, 'documentation.dictate');
  const dictationConfigured = isDictationConfigured();

  const supabase = await createClient();
  const [sitesRaw, { data: employees }] = await Promise.all([
    fetchAccessibleSites(supabase, ctx, 'id, name, client_name, address, latitude, longitude'),
    supabase.from('profiles').select('id, first_name, last_name, job_title').eq('tenant_id', ctx.tenant!.id).eq('is_active', true).order('last_name'),
  ]);

  const sites = sitesRaw as Array<{
    id: string;
    name: string;
    client_name: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  }>;

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('*, sites(name, client_name, address)')
    .order('log_date', { ascending: false })
    .limit(20);

  const logIds = (logs ?? []).map((log) => log.id);

  const [
    { data: photos },
    { data: deliveries },
    { data: subcontractors },
    { data: workerHours },
    { data: workItems },
    { data: resources },
    { data: signatures },
  ] = logIds.length
    ? await Promise.all([
        supabase.from('daily_log_photos').select('*').in('daily_log_id', logIds),
        supabase.from('delivery_notes').select('*').in('daily_log_id', logIds),
        supabase.from('subcontractor_entries').select('*').in('daily_log_id', logIds),
        supabase.from('daily_log_worker_hours').select('*').in('daily_log_id', logIds),
        supabase.from('daily_log_work').select('*').in('daily_log_id', logIds),
        supabase.from('equipment_hours').select('*').in('daily_log_id', logIds),
        supabase.from('daily_log_signatures').select('*').in('daily_log_id', logIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const deliveryIds = (deliveries ?? []).map((delivery) => delivery.id);
  const { data: deliveryItems } = deliveryIds.length
    ? await supabase.from('delivery_note_items').select('*').in('delivery_note_id', deliveryIds).order('position')
    : { data: [] };

  const deleterIds = [
    ...(photos ?? []).map((p) => p.deleted_by),
    ...(deliveries ?? []).map((d) => d.deleted_by),
    ...(subcontractors ?? []).map((s) => s.deleted_by),
  ].filter((id): id is string => Boolean(id));

  const { data: deleters } = deleterIds.length
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', deleterIds)
    : { data: [] };

  const deleterById = new Map((deleters ?? []).map((profile) => [profile.id, profile]));

  const photoPaths = (photos ?? [])
    .filter((p) => !p.deleted_at && p.file_url)
    .map((p) => p.file_url) as string[];
  const deliveryPaths = (deliveries ?? [])
    .filter((d) => !d.deleted_at && d.file_url)
    .map((d) => d.file_url) as string[];
  const signaturePaths = (signatures ?? []).map((entry) => entry.file_url).filter(Boolean) as string[];
  const signedUrlMap = await getSignedFileUrls('daily-photos', [...photoPaths, ...deliveryPaths, ...signaturePaths]);
  const signedUrls = Object.fromEntries(signedUrlMap);

  type DeliveryItemRow = NonNullable<typeof deliveryItems>[number];
  type WorkerHoursRow = NonNullable<typeof workerHours>[number];
  type WorkItemRow = NonNullable<typeof workItems>[number];
  type ResourceRow = NonNullable<typeof resources>[number];
  type SignatureRow = NonNullable<typeof signatures>[number];

  const itemsByDelivery = new Map<string, DeliveryItemRow[]>();
  for (const item of deliveryItems ?? []) {
    const list = itemsByDelivery.get(item.delivery_note_id) ?? [];
    list.push(item);
    itemsByDelivery.set(item.delivery_note_id, list);
  }

  const workersByLog = new Map<string, WorkerHoursRow[]>();
  for (const row of workerHours ?? []) {
    const list = workersByLog.get(row.daily_log_id) ?? [];
    list.push(row);
    workersByLog.set(row.daily_log_id, list);
  }

  const workByLog = new Map<string, WorkItemRow[]>();
  for (const row of workItems ?? []) {
    const list = workByLog.get(row.daily_log_id) ?? [];
    list.push(row);
    workByLog.set(row.daily_log_id, list);
  }

  const resourcesByLog = new Map<string, ResourceRow[]>();
  for (const row of resources ?? []) {
    const list = resourcesByLog.get(row.daily_log_id) ?? [];
    list.push(row);
    resourcesByLog.set(row.daily_log_id, list);
  }

  const signaturesByLog = new Map<string, SignatureRow[]>();
  for (const row of signatures ?? []) {
    const list = signaturesByLog.get(row.daily_log_id) ?? [];
    list.push(row);
    signaturesByLog.set(row.daily_log_id, list);
  }

  let editInitial: DailyReportFormInitial | undefined;
  if (editLogId && canManage) {
    const editLog = (logs ?? []).find((log) => log.id === editLogId);
    if (editLog) {
      editInitial = {
        dailyLogId: editLog.id,
        reportType: parseDailyLogReportType(editLog.report_type as string),
        customTitle: editLog.custom_title,
        siteId: editLog.site_id,
        logDate: editLog.log_date,
        weather: editLog.weather ?? '',
        notes: editLog.notes ?? '',
        dictationTranscript: editLog.dictation_transcript,
        dictationExtraction: editLog.dictation_extraction as Record<string, unknown> | null,
        workers: (workersByLog.get(editLog.id) ?? []).map((row) => ({
          userId: row.user_id,
          workerName: row.worker_name,
          jobTitle: row.job_title,
          hours: Number(row.hours),
        })),
        workItems: (workByLog.get(editLog.id) ?? []).map((row) => ({
          description: row.description,
          quantity: row.quantity != null ? Number(row.quantity) : null,
          unit: row.unit,
        })),
        resources: (resourcesByLog.get(editLog.id) ?? []).map((row) => ({
          name: row.equipment_name,
          quantity: row.quantity != null ? Number(row.quantity) : null,
          unit: row.unit,
          hours: Number(row.hours),
        })),
        photos: (photos ?? [])
          .filter((photo) => photo.daily_log_id === editLog.id && !photo.deleted_at && photo.file_url)
          .map((photo) => ({ id: photo.id, url: signedUrls[photo.file_url] ?? '' })),
        signatures: (signaturesByLog.get(editLog.id) ?? []).map((entry) => ({
          role: entry.role as 'contractor' | 'client',
          signerName: entry.signer_name,
          url: signedUrls[entry.file_url] ?? null,
          signedAt: entry.signed_at,
          signedLatitude: entry.signed_latitude,
          signedLongitude: entry.signed_longitude,
          signedLocationLabel: entry.signed_location_label,
        })),
      };
    }
  }

  const filteredLogs = listArtFilter
    ? (logs ?? []).filter((log) => parseDailyLogReportType(log.report_type as string) === listArtFilter)
    : (logs ?? []);

  const logEntries = filteredLogs.map((log) => ({
    id: log.id,
    log_date: log.log_date,
    report_type: parseDailyLogReportType(log.report_type as string),
    custom_title: log.custom_title as string | null,
    weather: log.weather,
    notes: log.notes,
    site_name: (log.sites as { name: string; client_name: string | null; address: string | null } | null)?.name ?? '',
    client_name: (log.sites as { name: string; client_name: string | null; address: string | null } | null)?.client_name ?? null,
    workers: (workersByLog.get(log.id) ?? []).map((row) => ({
      worker_name: row.worker_name,
      job_title: row.job_title,
      hours: Number(row.hours),
    })),
    workItems: (workByLog.get(log.id) ?? []).map((row) => ({
      description: row.description,
      quantity: row.quantity != null ? Number(row.quantity) : null,
      unit: row.unit,
    })),
    resources: (resourcesByLog.get(log.id) ?? []).map((row) => ({
      name: row.equipment_name,
      quantity: row.quantity != null ? Number(row.quantity) : null,
      unit: row.unit,
      hours: Number(row.hours),
    })),
    photos: (photos ?? [])
      .filter((photo) => photo.daily_log_id === log.id)
      .map((photo) => ({
        id: photo.id,
        file_url: photo.file_url,
        deleted_at: photo.deleted_at,
        deleter: photo.deleted_by ? deleterById.get(photo.deleted_by) ?? null : null,
      })),
    deliveries: (deliveries ?? [])
      .filter((delivery) => delivery.daily_log_id === log.id)
      .map((delivery) => ({
        id: delivery.id,
        supplier_name: delivery.supplier_name,
        delivery_note_number: delivery.delivery_note_number,
        delivery_date: delivery.delivery_date,
        description: delivery.description,
        file_url: delivery.file_url,
        deleted_at: delivery.deleted_at,
        deleter: delivery.deleted_by ? deleterById.get(delivery.deleted_by) ?? null : null,
        items: (itemsByDelivery.get(delivery.id) ?? []).map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
        })),
      })),
    subcontractors: (subcontractors ?? [])
      .filter((entry) => entry.daily_log_id === log.id)
      .map((entry) => ({
        id: entry.id,
        company_name: entry.company_name,
        work_description: entry.work_description,
        hours: entry.hours,
        deleted_at: entry.deleted_at,
        deleter: entry.deleted_by ? deleterById.get(entry.deleted_by) ?? null : null,
      })),
    signatures: (signaturesByLog.get(log.id) ?? []).map((entry) => ({
      role: entry.role as 'contractor' | 'client',
      signer_name: entry.signer_name,
      file_url: entry.file_url,
      signed_at: entry.signed_at,
      signed_latitude: entry.signed_latitude,
      signed_longitude: entry.signed_longitude,
      signed_location_label: entry.signed_location_label,
    })),
  }));

  const dailyLogOptions = (logs ?? []).map((log) => {
    const siteName = (log.sites as { name: string } | null)?.name ?? '';
    return {
      id: log.id,
      label: `${log.log_date} · ${siteName}`,
    };
  });

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Baustellendokumentation</span>
          <h1>Baustellendokumentation</h1>
          <p>Tagesberichte und Std.-Lohn-Rapporte digital erfassen – mit optionaler Diktierfunktion und Pflichtfotos.</p>
        </div>
      </div>

      {canManage && (
        <section className="panel form-panel">
          <div className="daily-report-form-heading">
            <h2>{editInitial ? 'Bericht bearbeiten' : 'Neuer Bericht'}</h2>
            {editInitial && (
              <Link href="/app/dokumentation" className="table-action-link">
                Abbrechen
              </Link>
            )}
          </div>
          <DailyReportForm
            sites={sites}
            employees={employees ?? []}
            canDictate={canDictate}
            dictationConfigured={dictationConfigured}
            defaultReportType={defaultReportType}
            initial={
              editInitial ??
              (preselectedSiteId && sites.some((s) => s.id === preselectedSiteId)
                ? { siteId: preselectedSiteId }
                : undefined)
            }
          />
        </section>
      )}

      <section className="panel form-panel" style={{ marginTop: 16 }}>
        <h2>Lieferung erfassen</h2>
        {dailyLogOptions.length > 0 ? (
          <DeliveryNoteScanForm logs={dailyLogOptions} saveAction={saveDeliveryNote} />
        ) : (
          <p className="muted">Bitte zuerst einen Bericht anlegen, bevor Lieferungen erfasst werden können.</p>
        )}
      </section>

      <section className="panel form-panel" style={{ marginTop: 16 }}>
        <h2>Subunternehmer erfassen</h2>
        <form action={saveSubcontractorEntry} className="input-form">
          <div className="input-form-core">
            <label>
              Tageseintrag
              <select name="daily_log_id" required defaultValue="">
                <option value="" disabled>—</option>
                {(logs ?? []).map((log) => (
                  <option key={log.id} value={log.id}>
                    {log.log_date} · {(log.sites as { name: string }[] | null)?.[0]?.name ?? ''}
                  </option>
                ))}
              </select>
            </label>
            <label>Firma<input name="company_name" placeholder="Subunternehmer" required /></label>
            <label>Gewerk / Beschreibung<input name="work_description" placeholder="z.B. Pflasterarbeiten" /></label>
            <label>Stunden<input type="number" step="0.25" name="hours" min={0} /></label>
          </div>
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Subunternehmer speichern</button>
          </div>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="documentation-list-head">
          <h2>Letzte Berichte</h2>
          <nav className="inline-actions documentation-list-filter" aria-label="Berichte filtern">
            <Link
              href="/app/dokumentation"
              className={`table-action-link${!listArtFilter ? ' table-action-link--active' : ''}`}
            >
              Alle
            </Link>
            <Link
              href="/app/dokumentation?art=daily_report"
              className={`table-action-link${listArtFilter === 'daily_report' ? ' table-action-link--active' : ''}`}
            >
              Tagesberichte
            </Link>
            <Link
              href="/app/dokumentation?art=hourly_wage_rapport"
              className={`table-action-link${listArtFilter === 'hourly_wage_rapport' ? ' table-action-link--active' : ''}`}
            >
              Rapporte
            </Link>
          </nav>
        </div>
        <DailyLogEntriesList
          logs={logEntries}
          signedUrls={signedUrls}
          canDelete={canManage}
          canEdit={canManage}
        />
      </section>
    </>
  );
}
