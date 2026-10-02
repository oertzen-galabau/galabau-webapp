import { setPartnerActive, updatePartner } from '@/lib/actions/partners';
import type { TenantBusinessPartner } from '@/lib/types/database';

type Props = {
  partner: TenantBusinessPartner;
  canManage: boolean;
};

export function PartnerRow({ partner, canManage }: Props) {
  return (
    <div className="team-row team-row--list">
      <div className="team-row-main team-row-main--static">
        <span className="team-row-person">
          <strong>
            {partner.name}
            {!partner.is_active && <span className="muted"> (inaktiv)</span>}
          </strong>
          {partner.contact_person && <small>{partner.contact_person}</small>}
        </span>
        <span className="team-location">
          {partner.phone && <a href={`tel:${partner.phone}`}>{partner.phone}</a>}
          {partner.email && (
            <>
              {partner.phone ? ' · ' : null}
              <a href={`mailto:${partner.email}`}>{partner.email}</a>
            </>
          )}
        </span>
        {partner.notes && <p className="muted site-entity-notes">{partner.notes}</p>}
      </div>
      {canManage && (
        <div className="team-row-actions partner-row-actions">
          <details className="site-entity-edit">
            <summary>Bearbeiten</summary>
            <form action={updatePartner} className="input-form site-entity-edit-form">
              <input type="hidden" name="id" value={partner.id} />
              <input type="hidden" name="kind" value={partner.kind} />
              <label>Firma<input name="name" defaultValue={partner.name} required /></label>
              <label>Ansprechpartner<input name="contact_person" defaultValue={partner.contact_person ?? ''} /></label>
              <label>Telefon<input name="phone" type="tel" defaultValue={partner.phone ?? ''} /></label>
              <label>E-Mail<input name="email" type="email" defaultValue={partner.email ?? ''} /></label>
              <label className="input-form-span-full">
                Bemerkung
                <textarea name="notes" rows={3} defaultValue={partner.notes ?? ''} />
              </label>
              <button type="submit" className="primary-button primary-button--compact">Speichern</button>
            </form>
          </details>
          <form action={setPartnerActive}>
            <input type="hidden" name="id" value={partner.id} />
            <input type="hidden" name="kind" value={partner.kind} />
            <input type="hidden" name="is_active" value={partner.is_active ? 'false' : 'true'} />
            <button type="submit" className="secondary-button secondary-button--compact">
              {partner.is_active ? 'Deaktivieren' : 'Aktivieren'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
