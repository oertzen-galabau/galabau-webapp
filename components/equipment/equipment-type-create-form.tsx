import { createEquipmentType } from '@/lib/actions/equipment-types';

export function EquipmentTypeCreateForm() {
  return (
    <form action={createEquipmentType} className="input-form input-form--compact equipment-type-create-form">
      <div className="equipment-type-create-row">
        <label className="equipment-type-create-field">
          Bezeichnung
          <input name="name" required placeholder="z. B. Transporter" />
        </label>
        <button type="submit" className="primary-button primary-button--compact">
          Typ anlegen
        </button>
      </div>
    </form>
  );
}
