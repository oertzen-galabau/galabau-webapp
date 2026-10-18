import { updateWorkArea } from '@/lib/actions/work-areas';
import { WorkAreaScheduleCheckbox } from '@/components/settings/work-area-schedule-checkbox';
import type { TenantWorkArea } from '@/lib/types/database';

type Props = {
  area: TenantWorkArea;
  canManage: boolean;
};

export function WorkAreaRow({ area, canManage }: Props) {
  return (
    <div className="work-area-row">
      <div className="work-area-row-name">
        <strong>
          {area.name}
          {!area.is_active && <span className="muted"> (inaktiv)</span>}
        </strong>
      </div>

      <div className="work-area-row-controls">
        {canManage ? (
          <WorkAreaScheduleCheckbox
            areaId={area.id}
            checked={area.schedule_assignable}
            disabled={!area.is_active}
          />
        ) : (
          <span
            className="work-area-row-schedule-readonly"
            title={
              area.schedule_assignable
                ? 'Im Einsatzplan sichtbar'
                : 'Nicht im Einsatzplan'
            }
          >
            {area.schedule_assignable ? '✓ Einsatzplan' : '— Einsatzplan'}
          </span>
        )}

        {canManage ? (
          <details className="site-entity-edit work-area-row-edit">
            <summary>Bearbeiten</summary>
            <form action={updateWorkArea} className="input-form site-entity-edit-form">
              <input type="hidden" name="id" value={area.id} />
              <label>
                Bezeichnung
                <input name="name" defaultValue={area.name} required />
              </label>
              <label>
                Reihenfolge
                <input name="sort_order" type="number" defaultValue={area.sort_order} />
              </label>
              <label className="input-form-checkbox">
                <input type="checkbox" name="is_active" defaultChecked={area.is_active} />
                Aktiv
              </label>
              <label className="input-form-checkbox">
                <input
                  type="checkbox"
                  name="schedule_assignable"
                  defaultChecked={area.schedule_assignable}
                />
                Im Einsatzplan anzeigen
              </label>
              <button type="submit" className="primary-button primary-button--compact">
                Speichern
              </button>
            </form>
          </details>
        ) : null}
      </div>
    </div>
  );
}
