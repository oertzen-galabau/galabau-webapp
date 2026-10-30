import { createTenantContactPerson } from '@/lib/actions/partners';

export function TenantContactPersonCreateForm() {
  return (
    <form action={createTenantContactPerson} className="input-form">
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
      <div className="input-form-actions">
        <button type="submit" className="primary-button primary-button--compact">
          Ansprechpartner anlegen
        </button>
      </div>
    </form>
  );
}
