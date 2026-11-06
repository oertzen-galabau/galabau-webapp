'use client';

import { createEquipmentAction, type EquipmentFormState } from '@/lib/actions/equipment';
import { FileInputField } from '@/components/ui/file-input-field';
import { EQUIPMENT_STATUS_LABELS } from '@/lib/equipment/labels';
import type { TenantEquipmentStatus, TenantEquipmentType } from '@/lib/types/database';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

const initialState: EquipmentFormState = { error: null };

const STATUSES = Object.keys(EQUIPMENT_STATUS_LABELS) as TenantEquipmentStatus[];

type Props = {
  types: TenantEquipmentType[];
};

export function EquipmentCreateForm({ types }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createEquipmentAction, initialState);
  const [formKey, setFormKey] = useState(0);
  const defaultTypeId = types[0]?.id ?? '';

  useEffect(() => {
    if (!state.ok || state.error) return;
    router.refresh();
    setFormKey((key) => key + 1);
  }, [state.ok, state.error, router]);

  return (
    <form
      key={formKey}
      action={action}
      className="input-form equipment-create-form"
      encType="multipart/form-data"
    >
      <div className="input-form-core">
        <label>
          Bezeichnung
          <input name="name" required disabled={pending} placeholder="z. B. KX 019-4" />
        </label>
        <label>
          Typ
          <select name="equipment_type_id" required disabled={pending} defaultValue={defaultTypeId}>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
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
        <div className="equipment-create-form-last-row">
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
          <FileInputField
            compact
            className="equipment-create-photo"
            label="Foto"
            name="photo"
            accept="image/jpeg,image/png,image/webp,image/*"
            hint="JPG, PNG oder WebP"
            disabled={pending}
          />
        </div>
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
        {state.error ? <p className="form-error">{state.error}</p> : null}
        <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
          {pending ? 'Speichern…' : 'Anlegen'}
        </button>
      </div>
    </form>
  );
}
