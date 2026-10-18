import { createWorkArea } from '@/lib/actions/work-areas';

type Props = {
  nextSortOrder: number;
};

export function WorkAreaCreateForm({ nextSortOrder }: Props) {
  return (
    <form action={createWorkArea} className="input-form input-form--compact">
      <div className="input-form-core">
        <label>
          Bezeichnung
          <input name="name" required placeholder="z. B. Baustelle" />
        </label>
        <label>
          Reihenfolge
          <input name="sort_order" type="number" defaultValue={nextSortOrder} />
        </label>
        <label className="input-form-checkbox">
          <input type="checkbox" name="schedule_assignable" defaultChecked />
          Im Einsatzplan standardmäßig anzeigen
        </label>
      </div>
      <button type="submit" className="primary-button primary-button--compact">
        Bereich anlegen
      </button>
    </form>
  );
}
