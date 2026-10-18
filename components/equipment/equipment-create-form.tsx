'use client';

import { createEquipment } from '@/lib/actions/equipment';
import { EQUIPMENT_KIND_LABELS, EQUIPMENT_STATUS_LABELS } from '@/lib/equipment/labels';
import type { TenantEquipmentKind, TenantEquipmentStatus } from '@/lib/types/database';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

const KINDS = Object.keys(EQUIPMENT_KIND_LABELS) as TenantEquipmentKind[];
const STATUSES = Object.keys(EQUIPMENT_STATUS_LABELS) as TenantEquipmentStatus[];

export function EquipmentCreateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="input-form"
      encType="multipart/form-data"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await createEquipment(new FormData(e.currentTarget));
          e.currentTarget.reset();
          router.refresh();
        });
      }}
    >
      <div className="input-form-core">
        <label>
          Bezeichnung
          <input name="name" required disabled={pending} placeholder="z. B. KX 019-4" />
        </label>
        <label>
          Typ
          <select name="kind" required disabled={pending} defaultValue="equipment">
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {EQUIPMENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Foto
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" disabled={pending} />
        </label>
        <label>
          Baujahr
          <input type="number" name="build_year" min={1950} max={2100} disabled={pending} />
        </label>
        <label>
          Seriennummer
          <input name="serial_number" disabled={pending} />
        </label>
        <label>
          Inventarnummer
          <input name="inventory_number" disabled={pending} />
        </label>
        <label>
          UVV fällig
          <input type="date" name="uvv_due_date" disabled={pending} />
        </label>
        <label>
          Status
          <select name="status" disabled={pending} defaultValue="active">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {EQUIPMENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <details className="equipment-optional-fields">
        <summary>Optionale Angaben</summary>
        <div className="input-form-core">
          <label>
            Kennzeichen
            <input name="license_plate" disabled={pending} placeholder="z. B. PI-VO 35" />
          </label>
          <label>
            Hersteller / Modell
            <input name="manufacturer_model" disabled={pending} />
          </label>
          <label>
            HU / TÜV fällig
            <input type="date" name="inspection_due_date" disabled={pending} />
          </label>
          <label>
            Betriebsstunden
            <input type="number" step="0.1" name="operating_hours" min={0} disabled={pending} />
          </label>
          <label>
            Kilometerstand
            <input type="number" step="1" name="mileage_km" min={0} disabled={pending} />
          </label>
          <label>
            Führerscheinklasse
            <input name="license_class_required" disabled={pending} placeholder="z. B. B, T" />
          </label>
          <label>
            Buchungsnummer
            <input name="booking_number" disabled={pending} maxLength={50} placeholder="z. B. 2001" />
          </label>
          <label className="input-form-span-full">
            Notiz
            <textarea name="notes" rows={3} disabled={pending} />
          </label>
        </div>
      </details>
      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
          {pending ? 'Speichern…' : 'Anlegen'}
        </button>
      </div>
    </form>
  );
}
