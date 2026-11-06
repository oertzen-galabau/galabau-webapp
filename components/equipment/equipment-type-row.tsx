import { deleteEquipmentType, updateEquipmentType } from '@/lib/actions/equipment-types';
import { EditToggleLabel } from '@/components/ui/edit-toggle-label';
import { DeleteIconAction } from '@/components/ui/icon-action-button';
import type { TenantEquipmentType } from '@/lib/types/database';

type Props = {
  type: TenantEquipmentType;
  canManage: boolean;
  usageCount: number;
};

export function EquipmentTypeRow({ type, canManage, usageCount }: Props) {
  return (
    <div className="work-area-row equipment-type-row">
      <div className="work-area-row-name">
        <strong>
          {type.name}
          {!type.is_active ? <span className="muted"> (inaktiv)</span> : null}
        </strong>
        {usageCount > 0 ? (
          <span className="muted equipment-type-row-usage">
            {usageCount} {usageCount === 1 ? 'Eintrag' : 'Einträge'}
          </span>
        ) : null}
      </div>

      {canManage ? (
        <div className="work-area-row-controls">
          <details className="site-entity-edit work-area-row-edit">
            <summary>
              <EditToggleLabel />
            </summary>
            <form action={updateEquipmentType} className="input-form site-entity-edit-form">
              <input type="hidden" name="id" value={type.id} />
              <label>
                Bezeichnung
                <input name="name" defaultValue={type.name} required />
              </label>
              <label className="input-form-checkbox">
                <input type="checkbox" name="is_active" defaultChecked={type.is_active} />
                Aktiv
              </label>
              <button type="submit" className="primary-button primary-button--compact">
                Speichern
              </button>
            </form>
          </details>
          {usageCount === 0 ? (
            <form action={deleteEquipmentType} className="equipment-type-row-delete-form">
              <input type="hidden" name="id" value={type.id} />
              <DeleteIconAction type="submit" />
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
