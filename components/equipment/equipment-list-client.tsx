'use client';

import { setEquipmentActive, updateEquipment } from '@/lib/actions/equipment';
import { AppDialog } from '@/components/ui/app-dialogs';
import { AppSidePanel } from '@/components/ui/app-side-panel';
import {
  EQUIPMENT_KIND_LABELS,
  EQUIPMENT_STATUS_LABELS,
  isUvvOverdue,
} from '@/lib/equipment/labels';
import { todayIsoInBerlin } from '@/lib/schedule/week';
import type { TenantEquipment, TenantEquipmentKind, TenantEquipmentStatus } from '@/lib/types/database';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

export type EquipmentListItem = TenantEquipment & { photoUrl: string | null };

type Props = {
  items: EquipmentListItem[];
  canManage: boolean;
};

const ALL_KIND = 'all' as const;

export function EquipmentListClient({ items, canManage }: Props) {
  const router = useRouter();
  const today = todayIsoInBerlin();
  const [kindFilter, setKindFilter] = useState<TenantEquipmentKind | typeof ALL_KIND>(ALL_KIND);
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const [selected, setSelected] = useState<EquipmentListItem | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return items.filter((item) => kindFilter === ALL_KIND || item.kind === kindFilter);
  }, [items, kindFilter]);

  return (
    <>
      <div className="equipment-list-toolbar">
        <label className="equipment-list-filter">
          Typ
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as TenantEquipmentKind | typeof ALL_KIND)}
          >
            <option value={ALL_KIND}>Alle</option>
            {(Object.keys(EQUIPMENT_KIND_LABELS) as TenantEquipmentKind[]).map((k) => (
              <option key={k} value={k}>
                {EQUIPMENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="equipment-list">
        {filtered.map((item) => {
          const uvvOverdue = isUvvOverdue(item.uvv_due_date, today);
          return (
            <div key={item.id} className={`equipment-list-row${!item.is_active ? ' equipment-list-row-inactive' : ''}`}>
              <button
                type="button"
                className="equipment-list-thumb"
                onClick={() => {
                  if (item.photoUrl) setLightbox({ url: item.photoUrl, title: item.name });
                }}
                aria-label={item.photoUrl ? `${item.name} vergrößern` : 'Kein Foto'}
                disabled={!item.photoUrl}
              >
                {item.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photoUrl} alt="" />
                ) : (
                  <span className="equipment-list-thumb-placeholder">{EQUIPMENT_KIND_LABELS[item.kind].charAt(0)}</span>
                )}
              </button>
              <button type="button" className="equipment-list-main" onClick={() => setSelected(item)}>
                <span className="equipment-list-title">
                  <strong>{item.name}</strong>
                  <span className="status-badge">{EQUIPMENT_KIND_LABELS[item.kind]}</span>
                  {item.status !== 'active' ? (
                    <span className="status-badge">{EQUIPMENT_STATUS_LABELS[item.status]}</span>
                  ) : null}
                  {!item.is_active ? <span className="muted">(inaktiv)</span> : null}
                </span>
                <span className="equipment-list-meta muted">
                  {item.inventory_number ? `Inv. ${item.inventory_number}` : '—'}
                  {' · '}
                  {item.serial_number ? `SN ${item.serial_number}` : '—'}
                  {' · '}
                  {item.build_year ?? '—'}
                  {' · '}
                  <span className={uvvOverdue ? 'equipment-uvv-overdue' : undefined}>
                    UVV {item.uvv_due_date ?? '—'}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
        {filtered.length === 0 ? <p className="muted equipment-list-empty">Keine Einträge für diesen Filter.</p> : null}
      </div>

      <AppDialog
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        title={lightbox?.title ?? ''}
        panelClassName="dialog-panel--image"
      >
        {lightbox ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lightbox.url} alt={lightbox.title} className="equipment-lightbox-image" />
        ) : null}
      </AppDialog>

      <AppSidePanel open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name ?? ''}>
        {selected ? (
          <EquipmentDetailPanel
            item={selected}
            canManage={canManage}
            pending={pending}
            today={today}
            onSubmit={(fd) => {
              startTransition(async () => {
                await updateEquipment(fd);
                setSelected(null);
                router.refresh();
              });
            }}
            onToggleActive={() => {
              startTransition(async () => {
                const fd = new FormData();
                fd.set('id', selected.id);
                fd.set('is_active', selected.is_active ? 'false' : 'true');
                await setEquipmentActive(fd);
                setSelected(null);
                router.refresh();
              });
            }}
          />
        ) : null}
      </AppSidePanel>
    </>
  );
}

function EquipmentDetailPanel({
  item,
  canManage,
  pending,
  today,
  onSubmit,
  onToggleActive,
}: {
  item: EquipmentListItem;
  canManage: boolean;
  pending: boolean;
  today: string;
  onSubmit: (fd: FormData) => void;
  onToggleActive: () => void;
}) {
  const uvvOverdue = isUvvOverdue(item.uvv_due_date, today);

  return (
    <div className="equipment-detail">
      {item.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.photoUrl} alt={item.name} className="equipment-detail-photo" />
      ) : null}
      <dl className="equipment-detail-facts">
        <div>
          <dt>Typ</dt>
          <dd>{EQUIPMENT_KIND_LABELS[item.kind]}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{EQUIPMENT_STATUS_LABELS[item.status]}</dd>
        </div>
        <div>
          <dt>Baujahr</dt>
          <dd>{item.build_year ?? '—'}</dd>
        </div>
        <div>
          <dt>Seriennummer</dt>
          <dd>{item.serial_number ?? '—'}</dd>
        </div>
        <div>
          <dt>Inventarnummer</dt>
          <dd>{item.inventory_number ?? '—'}</dd>
        </div>
        <div>
          <dt className={uvvOverdue ? 'equipment-uvv-overdue' : undefined}>UVV fällig</dt>
          <dd className={uvvOverdue ? 'equipment-uvv-overdue' : undefined}>{item.uvv_due_date ?? '—'}</dd>
        </div>
        {item.license_plate ? (
          <div>
            <dt>Kennzeichen</dt>
            <dd>{item.license_plate}</dd>
          </div>
        ) : null}
        {item.manufacturer_model ? (
          <div>
            <dt>Hersteller / Modell</dt>
            <dd>{item.manufacturer_model}</dd>
          </div>
        ) : null}
        {item.inspection_due_date ? (
          <div>
            <dt>HU / TÜV</dt>
            <dd>{item.inspection_due_date}</dd>
          </div>
        ) : null}
        {item.operating_hours != null ? (
          <div>
            <dt>Betriebsstunden</dt>
            <dd>{item.operating_hours}</dd>
          </div>
        ) : null}
        {item.mileage_km != null ? (
          <div>
            <dt>Kilometer</dt>
            <dd>{item.mileage_km}</dd>
          </div>
        ) : null}
        {item.license_class_required ? (
          <div>
            <dt>Führerschein</dt>
            <dd>{item.license_class_required}</dd>
          </div>
        ) : null}
        {item.notes ? (
          <div className="equipment-detail-notes">
            <dt>Notiz</dt>
            <dd>{item.notes}</dd>
          </div>
        ) : null}
      </dl>

      {canManage ? (
        <>
          <form
            className="input-form equipment-detail-form"
            encType="multipart/form-data"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(new FormData(e.currentTarget));
            }}
          >
            <input type="hidden" name="id" value={item.id} />
            <p className="input-form-section-title">Bearbeiten</p>
            <div className="input-form-core">
              <label>
                Bezeichnung
                <input name="name" required defaultValue={item.name} disabled={pending} />
              </label>
              <label>
                Typ
                <select name="kind" required defaultValue={item.kind} disabled={pending}>
                  {(Object.keys(EQUIPMENT_KIND_LABELS) as TenantEquipmentKind[]).map((k) => (
                    <option key={k} value={k}>
                      {EQUIPMENT_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Neues Foto
                <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" disabled={pending} />
              </label>
              <label>
                Baujahr
                <input type="number" name="build_year" min={1950} max={2100} defaultValue={item.build_year ?? ''} disabled={pending} />
              </label>
              <label>
                Seriennummer
                <input name="serial_number" defaultValue={item.serial_number ?? ''} disabled={pending} />
              </label>
              <label>
                Inventarnummer
                <input name="inventory_number" defaultValue={item.inventory_number ?? ''} disabled={pending} />
              </label>
              <label>
                UVV fällig
                <input type="date" name="uvv_due_date" defaultValue={item.uvv_due_date ?? ''} disabled={pending} />
              </label>
              <label>
                Kennzeichen
                <input name="license_plate" defaultValue={item.license_plate ?? ''} disabled={pending} />
              </label>
              <label>
                Hersteller / Modell
                <input name="manufacturer_model" defaultValue={item.manufacturer_model ?? ''} disabled={pending} />
              </label>
              <label>
                HU / TÜV fällig
                <input type="date" name="inspection_due_date" defaultValue={item.inspection_due_date ?? ''} disabled={pending} />
              </label>
              <label>
                Betriebsstunden
                <input type="number" step="0.1" name="operating_hours" defaultValue={item.operating_hours ?? ''} disabled={pending} />
              </label>
              <label>
                Kilometerstand
                <input type="number" step="1" name="mileage_km" defaultValue={item.mileage_km ?? ''} disabled={pending} />
              </label>
              <label>
                Führerscheinklasse
                <input name="license_class_required" defaultValue={item.license_class_required ?? ''} disabled={pending} />
              </label>
              <label>
                Status
                <select name="status" defaultValue={item.status} disabled={pending}>
                  {(Object.keys(EQUIPMENT_STATUS_LABELS) as TenantEquipmentStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {EQUIPMENT_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="input-form-span-full">
                Notiz
                <textarea name="notes" rows={3} defaultValue={item.notes ?? ''} disabled={pending} />
              </label>
            </div>
            <div className="input-form-actions">
              <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
                {pending ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </form>
          <button type="button" className="secondary-button secondary-button--compact" disabled={pending} onClick={onToggleActive}>
            {item.is_active ? 'Deaktivieren' : 'Aktivieren'}
          </button>
        </>
      ) : null}
    </div>
  );
}
