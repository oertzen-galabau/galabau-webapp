import { createEquipmentType } from '@/lib/actions/equipment-types';

type Props = {
  nextSortOrder: number;
};

export function EquipmentTypeCreateForm({ nextSortOrder }: Props) {
  return (
    <form action={createEquipmentType} className="input-form input-form--compact">
      <div className="input-form-core">
        <label>
          Bezeichnung
          <input name="name" required placeholder="z. B. Transporter" />
        </label>
        <label>
          Reihenfolge
          <input name="sort_order" type="number" defaultValue={nextSortOrder} />
        </label>
      </div>
      <button type="submit" className="primary-button primary-button--compact">
        Typ anlegen
      </button>
    </form>
  );
}
