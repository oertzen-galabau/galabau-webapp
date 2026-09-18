import { createClient } from '@/lib/supabase/server';
import { requireTenantMember } from '@/lib/auth/session';
import { saveDailyLog, saveDeliveryNote, saveSubcontractorEntry } from '@/lib/actions/admin';
import { canAccess } from '@/lib/auth/session';
import { DailyLogEntriesList } from '@/components/documentation/daily-log-entries-list';
import { DailyLogWorkEquipmentRows } from '@/components/documentation/daily-log-work-equipment-rows';
import { DeliveryNoteScanForm } from '@/components/documentation/delivery-note-scan-form';
import { FileInputField } from '@/components/ui/file-input-field';
import { getSignedFileUrls } from '@/lib/supabase/storage';
import { AppSelect } from '@/components/ui/app-select';

export default async function DokumentationPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.dokumentation')) {
    return <p className="muted">Keine Berechtigung für die Baustellendokumentation.</p>;
  }

  const supabase = await createClient();
  const { data: sites } = await supabase.from('sites').select('id, name').eq('is_active', true);
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('*, sites(name)')
    .order('log_date', { ascending: false })
    .limit(20);

  const logIds = (logs ?? []).map((log) => log.id);

  const [{ data: photos }, { data: deliveries }, { data: subcontractors }] = logIds.length
    ? await Promise.all([
        supabase.from('daily_log_photos').select('*').in('daily_log_id', logIds),
        supabase.from('delivery_notes').select('*').in('daily_log_id', logIds),
        supabase.from('subcontractor_entries').select('*').in('daily_log_id', logIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

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
  const signedUrlMap = await getSignedFileUrls('daily-photos', [...photoPaths, ...deliveryPaths]);
  const signedUrls = Object.fromEntries(signedUrlMap);

  const itemsByDelivery = new Map<string, typeof deliveryItems>();
  for (const item of deliveryItems ?? []) {
    const list = itemsByDelivery.get(item.delivery_note_id) ?? [];
    list.push(item);
    itemsByDelivery.set(item.delivery_note_id, list);
  }

  const canDelete = canAccess(ctx, 'documentation.manage');

  const logEntries = (logs ?? []).map((log) => ({
    id: log.id,
    log_date: log.log_date,
    weather: log.weather,
    notes: log.notes,
    site_name: (log.sites as { name: string }[] | null)?.[0]?.name ?? '',
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
  }));

  const dailyLogOptions = (logs ?? []).map((log) => ({
    id: log.id,
    label: `${log.log_date} · ${(log.sites as { name: string }[] | null)?.[0]?.name ?? ''}`,
  }));

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Baustellendokumentation</span>
          <h1>Tagesdokumentation</h1>
          <p>Arbeiten, Gerätestunden, Fotos, Lieferungen und Subunternehmer erfassen.</p>
        </div>
      </div>

      <section className="panel form-panel">
        <h2>Neuer Tageseintrag</h2>
        <form action={saveDailyLog} className="input-form">
          <div className="input-form-section">
            <h3 className="input-form-section-title">Grunddaten</h3>
            <div className="input-form-core">
              <label>Baustelle
                <AppSelect
                  name="site_id"
                  required
                  allowEmpty={false}
                  options={(sites ?? []).map((s) => ({ value: s.id, label: s.name }))}
                />
              </label>
              <label>Datum<input type="date" name="log_date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
              <label>Wetter<input name="weather" placeholder="z.B. 18°C, trocken" /></label>
            </div>
          </div>
          <div className="input-form-section">
            <h3 className="input-form-section-title">Arbeit & Geräte</h3>
            <DailyLogWorkEquipmentRows />
          </div>
          <details className="input-form-extra">
            <summary>Fotos & Notizen</summary>
            <div className="input-form-extra-grid">
              <FileInputField
                className="input-form-span-2"
                label="Fotos"
                name="photos"
                accept="image/*"
                capture="environment"
                multiple
                hint="JPG, PNG"
              />
              <label className="input-form-span-full">Bemerkungen<textarea name="notes" rows={3} /></label>
            </div>
          </details>
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Speichern</button>
          </div>
        </form>
      </section>

      <section className="panel form-panel" style={{ marginTop: 16 }}>
        <h2>Lieferung erfassen</h2>
        {dailyLogOptions.length > 0 ? (
          <DeliveryNoteScanForm logs={dailyLogOptions} saveAction={saveDeliveryNote} />
        ) : (
          <p className="muted">Bitte zuerst einen Tageseintrag anlegen, bevor Lieferungen erfasst werden können.</p>
        )}
      </section>

      <section className="panel form-panel" style={{ marginTop: 16 }}>
        <h2>Subunternehmer erfassen</h2>
        <form action={saveSubcontractorEntry} className="input-form">
          <div className="input-form-core">
            <label>Tageseintrag
              <AppSelect
                name="daily_log_id"
                required
                allowEmpty={false}
                options={(logs ?? []).map((log) => ({
                  value: log.id,
                  label: `${log.log_date} · ${(log.sites as { name: string }[] | null)?.[0]?.name ?? ''}`,
                }))}
              />
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
        <h2>Letzte Einträge</h2>
        <DailyLogEntriesList logs={logEntries} signedUrls={signedUrls} canDelete={canDelete} />
      </section>
    </>
  );
}
