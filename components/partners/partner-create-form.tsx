import { createPartner } from '@/lib/actions/partners';
import type { BusinessPartnerKind } from '@/lib/types/database';

type Props = {
  kind: BusinessPartnerKind;
  formId?: string;
  revalidateSiteId?: string;
  hideActions?: boolean;
};

export function PartnerCreateForm({ kind, formId, revalidateSiteId, hideActions = false }: Props) {
  return (
    <form id={formId} action={createPartner} className="input-form">
      <input type="hidden" name="kind" value={kind} />
      {revalidateSiteId ? <input type="hidden" name="revalidate_site_id" value={revalidateSiteId} /> : null}
      <div className="input-form-core input-form-core--grid">
        <label>Firma<input name="name" required placeholder="Firmenname" /></label>
        <label>Ansprechpartner<input name="contact_person" placeholder="Optional" /></label>
        <label>Telefon<input name="phone" type="tel" placeholder="Optional" /></label>
        <label>E-Mail<input name="email" type="email" placeholder="Optional" /></label>
        <label className="input-form-span-full">
          Bemerkung
          <textarea name="notes" rows={2} placeholder="Optional" />
        </label>
      </div>
      {!hideActions ? (
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact">
            Eintrag anlegen
          </button>
        </div>
      ) : null}
    </form>
  );
}
