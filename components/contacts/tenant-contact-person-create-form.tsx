import { createTenantContactPerson } from '@/lib/actions/partners';

type Props = {
  formId?: string;
  revalidateSiteId?: string;
  hideActions?: boolean;
};

export function TenantContactPersonCreateForm({ formId, revalidateSiteId, hideActions = false }: Props) {
  return (
    <form id={formId} action={createTenantContactPerson} className="input-form">
      {revalidateSiteId ? <input type="hidden" name="revalidate_site_id" value={revalidateSiteId} /> : null}
      <div className="input-form-core input-form-core--grid">
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          Rolle
          <input name="role_title" placeholder="z.B. Bauleiter" />
        </label>
        <label>
          Telefon
          <input name="phone" type="tel" />
        </label>
        <label>
          E-Mail
          <input name="email" type="email" />
        </label>
      </div>
      {!hideActions ? (
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact">
            Ansprechpartner anlegen
          </button>
        </div>
      ) : null}
    </form>
  );
}
