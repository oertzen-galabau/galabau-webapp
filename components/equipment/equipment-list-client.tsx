'use client';

import {
  deleteEquipment,
  setEquipmentActive,
  updateEquipmentAction,
  type EquipmentFormState,
} from '@/lib/actions/equipment';
import { AppDialog, ConfirmDialog } from '@/components/ui/app-dialogs';
import { DeleteIconAction } from '@/components/ui/icon-action-button';
import { AppSidePanel } from '@/components/ui/app-side-panel';
import { FileInputField } from '@/components/ui/file-input-field';
import { EQUIPMENT_STATUS_LABELS, uvvUrgency, uvvUrgencyCssClass } from '@/lib/equipment/labels';
import { todayIsoInBerlin } from '@/lib/schedule/week';
import type { TenantEquipment, TenantEquipmentStatus, TenantEquipmentType } from '@/lib/types/database';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';

const equipmentFormInitialState: EquipmentFormState = { error: null };

export type EquipmentListItem = TenantEquipment & { photoUrl: string | null; typeName: string };

type Props = {
  items: EquipmentListItem[];
  types: TenantEquipmentType[];
  canManage: boolean;
};

const ALL_TYPES = 'all' as const;

export function EquipmentListClient({ items, types, canManage }: Props) {
  const router = useRouter();
  const today = todayIsoInBerlin();
  const activeTypes = useMemo(() => types.filter((type) => type.is_active), [types]);
  const [typeFilter, setTypeFilter] = useState<string | typeof ALL_TYPES>(ALL_TYPES);
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null);
  const [selected, setSelected] = useState<EquipmentListItem | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [togglePending, startToggleTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<EquipmentListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function confirmDeleteEquipment() {
    if (!deleteTarget) return;
    startDeleteTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('id', deleteTarget.id);
        await deleteEquipment(fd);
        if (selected?.id === deleteTarget.id) setSelected(null);
        setDeleteTarget(null);
        setDeleteError(null);
        router.refresh();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
      }
    });
  }

  const countByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.equipment_type_id, (counts.get(item.equipment_type_id) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const filterTypes = useMemo(
    () => types.filter((type) => type.is_active || (countByType.get(type.id) ?? 0) > 0),
    [types, countByType],
  );

  const filtered = useMemo(() => {
    return items.filter((item) => typeFilter === ALL_TYPES || item.equipment_type_id === typeFilter);
  }, [items, typeFilter]);

  return (
    <>
      <div className="equipment-list-toolbar">
        <div className="equipment-list-filter-wrap">
          <span className="equipment-list-filter-label" id="equipment-type-filter-label">
            Typ
          </span>
          <div
            className="equipment-list-filter"
            role="group"
            aria-labelledby="equipment-type-filter-label"
          >
            <button
              type="button"
              className={`equipment-list-filter-segment${typeFilter === ALL_TYPES ? ' equipment-list-filter-segment--active' : ''}`}
              aria-pressed={typeFilter === ALL_TYPES}
              onClick={() => setTypeFilter(ALL_TYPES)}
            >
              Alle
              <span className="equipment-list-filter-count">{items.length}</span>
            </button>
            {filterTypes.map((type) => {
              const count = countByType.get(type.id) ?? 0;
              return (
                <button
                  key={type.id}
                  type="button"
                  className={`equipment-list-filter-segment${typeFilter === type.id ? ' equipment-list-filter-segment--active' : ''}`}
                  aria-pressed={typeFilter === type.id}
                  onClick={() => setTypeFilter(type.id)}
                >
                  {type.name}
                  {!type.is_active ? <span className="muted"> (inaktiv)</span> : null}
                  <span className="equipment-list-filter-count">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="equipment-list">
        {filtered.map((item) => {
          const huClass = uvvUrgencyCssClass(uvvUrgency(item.inspection_due_date, today));
          const insClass = uvvUrgencyCssClass(uvvUrgency(item.general_inspection_due_date, today));
          const uvvClass = uvvUrgencyCssClass(uvvUrgency(item.uvv_due_date, today));
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
                  <span className="equipment-list-thumb-placeholder">{item.typeName.charAt(0)}</span>
                )}
              </button>
              <button
                type="button"
                className="equipment-list-main"
                onClick={() => {
                  setToggleError(null);
                  setSelected(item);
                }}
              >
                <span className="equipment-list-title">
                  <strong>{item.name}</strong>
                  <span className="status-badge">{item.typeName}</span>
                  {item.status !== 'active' ? (
                    <span className="status-badge">{EQUIPMENT_STATUS_LABELS[item.status]}</span>
                  ) : null}
                  {!item.is_active ? <span className="muted">(inaktiv)</span> : null}
                </span>
                <span className="equipment-list-meta muted">
                  {item.inventory_number ?? '—'}
                  {' · '}
                  {item.serial_number ? `SN ${item.serial_number}` : '—'}
                  {' · '}
                  {item.build_year ?? '—'}
                  {' · '}
                  <span className={huClass}>HU/TÜV {item.inspection_due_date ?? '—'}</span>
                  {' · '}
                  <span className={insClass}>Inspektion {item.general_inspection_due_date ?? '—'}</span>
                  {' · '}
                  <span className={uvvClass}>UVV {item.uvv_due_date ?? '—'}</span>
                  {item.booking_number ? (
                    <>
                      {' · '}
                      Buch.-Nr. {item.booking_number}
                    </>
                  ) : null}
                </span>
              </button>
              {canManage ? (
                <div className="equipment-list-row-actions">
                  <DeleteIconAction
                    disabled={deletePending}
                    onClick={() => {
                      setDeleteError(null);
                      setDeleteTarget(item);
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
        {filtered.length === 0 ? <p className="muted equipment-list-empty">Keine Einträge für diesen Filter.</p> : null}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => confirmDeleteEquipment()}
        title="Fahrzeug / Gerät löschen"
        message={`„${deleteTarget?.name ?? ''}“ unwiderruflich löschen? Zuordnungen in Einsatzplänen werden entfernt.${deleteError ? `\n\n${deleteError}` : ''}`}
        confirmLabel="Löschen"
        danger
        pending={deletePending}
      />

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
            key={selected.id}
            item={selected}
            canManage={canManage}
            activeTypes={activeTypes}
            togglePending={togglePending}
            toggleError={toggleError}
            today={today}
            onSaved={() => {
              setSelected(null);
              router.refresh();
            }}
            onToggleActive={() => {
              setToggleError(null);
              startToggleTransition(async () => {
                try {
                  const fd = new FormData();
                  fd.set('id', selected.id);
                  fd.set('is_active', selected.is_active ? 'false' : 'true');
                  await setEquipmentActive(fd);
                  setSelected(null);
                  router.refresh();
                } catch (err) {
                  setToggleError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen');
                }
              });
            }}
            onDelete={() => {
              setDeleteError(null);
              setDeleteTarget(selected);
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
  activeTypes,
  togglePending,
  toggleError,
  today,
  onSaved,
  onToggleActive,
  onDelete,
}: {
  item: EquipmentListItem;
  canManage: boolean;
  activeTypes: TenantEquipmentType[];
  togglePending: boolean;
  toggleError: string | null;
  today: string;
  onSaved: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const [state, action, pending] = useActionState(updateEquipmentAction, equipmentFormInitialState);
  const huClass = uvvUrgencyCssClass(uvvUrgency(item.inspection_due_date, today));
  const genInspClass = uvvUrgencyCssClass(uvvUrgency(item.general_inspection_due_date, today));
  const uvvClass = uvvUrgencyCssClass(uvvUrgency(item.uvv_due_date, today));

  useEffect(() => {
    if (!state.ok || state.error) return;
    onSaved();
  }, [state.ok, state.error, onSaved]);

  return (
    <div className="equipment-detail">
      {item.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.photoUrl} alt={item.name} className="equipment-detail-photo" />
      ) : null}
      {!canManage ? (
        <dl className="equipment-detail-facts">
          <div>
            <dt>Typ</dt>
            <dd>{item.typeName}</dd>
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
            <dt className={huClass}>HU / TÜV fällig</dt>
            <dd className={huClass}>{item.inspection_due_date ?? '—'}</dd>
          </div>
          <div>
            <dt className={genInspClass}>Inspektion fällig</dt>
            <dd className={genInspClass}>{item.general_inspection_due_date ?? '—'}</dd>
          </div>
          <div>
            <dt className={uvvClass}>UVV fällig</dt>
            <dd className={uvvClass}>{item.uvv_due_date ?? '—'}</dd>
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
          {item.booking_number ? (
            <div>
              <dt>Buchungsnummer</dt>
              <dd>{item.booking_number}</dd>
            </div>
          ) : null}
          {item.notes ? (
            <div className="equipment-detail-notes">
              <dt>Notiz</dt>
              <dd>{item.notes}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {canManage ? (
        <>
          <form action={action} className="input-form equipment-detail-form">
            <input type="hidden" name="id" value={item.id} />
            <p className="input-form-section-title">Bearbeiten</p>
            <div className="input-form-core">
              <label>
                Bezeichnung
                <input name="name" required defaultValue={item.name} disabled={pending} />
              </label>
              <label>
                Typ
                <select name="equipment_type_id" required defaultValue={item.equipment_type_id} disabled={pending}>
                  {activeTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                  {!activeTypes.some((type) => type.id === item.equipment_type_id) ? (
                    <option value={item.equipment_type_id}>{item.typeName} (inaktiv)</option>
                  ) : null}
                </select>
              </label>
              <FileInputField
                label="Neues Foto"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
                hint="JPG, PNG oder WebP"
                disabled={pending}
              />
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
                Inspektion fällig
                <input
                  type="date"
                  name="general_inspection_due_date"
                  defaultValue={item.general_inspection_due_date ?? ''}
                  disabled={pending}
                />
              </label>
              <label>
                UVV fällig
                <input type="date" name="uvv_due_date" defaultValue={item.uvv_due_date ?? ''} disabled={pending} />
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
                Buchungsnummer
                <input
                  name="booking_number"
                  defaultValue={item.booking_number ?? ''}
                  maxLength={50}
                  disabled={pending}
                  placeholder="z. B. 2001"
                />
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
              {state.error ? <p className="form-error">{state.error}</p> : null}
              <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
                {pending ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </form>
          {toggleError ? <p className="form-error">{toggleError}</p> : null}
          <div className="equipment-detail-manage-actions">
            <button
              type="button"
              className="secondary-button secondary-button--compact"
              disabled={togglePending || pending}
              onClick={onToggleActive}
            >
              {item.is_active ? 'Deaktivieren' : 'Aktivieren'}
            </button>
            <button
              type="button"
              className="primary-button primary-button--compact primary-button--danger"
              disabled={togglePending || pending}
              onClick={onDelete}
            >
              Löschen
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
