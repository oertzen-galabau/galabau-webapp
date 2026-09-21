import { updateSite } from '@/lib/actions/admin';
import type { Site } from '@/lib/types/database';

type Props = {
  site: Site;
  canEdit: boolean;
};

export function SiteMetaForm({ site, canEdit }: Props) {
  return (
    <form action={canEdit ? updateSite : undefined} className="site-meta-form input-form">
      <input type="hidden" name="site_id" value={site.id} />
      <div className="site-meta-form-grid">
        <label className="input-form-span-full">
          Straße mit Nr.
          <input name="street" defaultValue={site.street ?? ''} readOnly={!canEdit} disabled={!canEdit} />
        </label>
        <label>
          PLZ
          <input name="zip_code" defaultValue={site.zip_code ?? ''} readOnly={!canEdit} disabled={!canEdit} />
        </label>
        <label>
          Ort
          <input name="city" defaultValue={site.city ?? ''} readOnly={!canEdit} disabled={!canEdit} />
        </label>
        <label className="input-form-span-full">
          Anfahrt
          <input name="directions" defaultValue={site.directions ?? ''} placeholder="Anfahrtshinweise" readOnly={!canEdit} disabled={!canEdit} />
        </label>
        <label>
          Standard-Wegezeit (Min.)
          <input
            type="number"
            name="default_travel_minutes"
            min={0}
            defaultValue={site.default_travel_minutes ?? 0}
            readOnly={!canEdit}
            disabled={!canEdit}
          />
        </label>
        <label>
          Kunde
          <input name="client_name" defaultValue={site.client_name ?? ''} readOnly={!canEdit} disabled={!canEdit} />
        </label>
        <label>
          Von
          <input type="date" name="start_date" defaultValue={site.start_date ?? ''} readOnly={!canEdit} disabled={!canEdit} />
        </label>
        <label>
          Bis
          <input type="date" name="end_date" defaultValue={site.end_date ?? ''} readOnly={!canEdit} disabled={!canEdit} />
        </label>
        <label className="input-form-span-full">
          Notizen
          <textarea name="notes" rows={3} defaultValue={site.notes ?? ''} readOnly={!canEdit} disabled={!canEdit} />
        </label>
      </div>
      {canEdit && (
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact">Stammdaten speichern</button>
        </div>
      )}
    </form>
  );
}
