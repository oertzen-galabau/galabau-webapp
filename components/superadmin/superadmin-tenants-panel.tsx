import { createTenant, openTenantAsSuperadmin, updateTenantStatus } from '@/lib/actions/superadmin';
import { AppSelect } from '@/components/ui/app-select';
import { SaveIconAction, TableIconActions } from '@/components/ui/icon-action-button';
import type { Tenant } from '@/lib/types/database';

const TENANT_STATUS_OPTIONS = [
  { value: 'trial', label: 'trial' },
  { value: 'active', label: 'active' },
  { value: 'suspended', label: 'suspended' },
];

type Props = {
  tenants: Tenant[];
};

export function SuperadminTenantsPanel({ tenants }: Props) {
  return (
    <>
      <section className="panel form-panel superadmin-tab-panel">
        <h2>Mandanten anlegen</h2>
        <form action={createTenant} className="input-form">
          <div className="input-form-core">
            <label>
              Slug (Subdomain)
              <input name="slug" required placeholder="musterbetrieb" />
            </label>
            <label>
              Firmenname
              <input name="name" required />
            </label>
            <label>
              Admin E-Mail
              <input name="admin_email" type="email" required />
            </label>
            <label>
              Admin Passwort
              <input name="admin_password" type="password" required minLength={8} />
            </label>
            <label>
              Admin Vorname
              <input name="admin_first_name" required />
            </label>
            <label>
              Admin Nachname
              <input name="admin_last_name" required />
            </label>
          </div>
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">
              Mandant erstellen
            </button>
          </div>
        </form>
      </section>

      <section className="panel superadmin-tab-panel">
        <h2>Alle Mandanten</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="data-table-col--optional">Slug</th>
                <th>Status</th>
                <th className="data-table-col--optional">Plan</th>
                <th>Aktion</th>
                <th>App</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    Keine Mandanten
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>{tenant.name}</td>
                    <td className="data-table-col--optional">{tenant.slug}</td>
                    <td>{tenant.status}</td>
                    <td className="data-table-col--optional">{tenant.plan}</td>
                    <td className="data-table-actions">
                      <form action={updateTenantStatus} className="superadmin-tenant-status-form">
                        <input type="hidden" name="id" value={tenant.id} />
                        <AppSelect
                          name="status"
                          defaultValue={tenant.status}
                          allowEmpty={false}
                          options={TENANT_STATUS_OPTIONS}
                        />
                        <TableIconActions>
                          <SaveIconAction type="submit" />
                        </TableIconActions>
                      </form>
                    </td>
                    <td>
                      <form action={openTenantAsSuperadmin}>
                        <input type="hidden" name="slug" value={tenant.slug} />
                        <button type="submit" className="secondary-button secondary-button--compact">
                          App öffnen
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
