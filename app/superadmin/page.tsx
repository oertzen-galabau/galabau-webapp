import Link from 'next/link';
import { requireSuperadmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createTenant, openTenantAsSuperadmin, updateTenantStatus } from '@/lib/actions/superadmin';
import { AppSelect } from '@/components/ui/app-select';
import { SaveIconAction, TableIconActions } from '@/components/ui/icon-action-button';

const TENANT_STATUS_OPTIONS = [
  { value: 'trial', label: 'trial' },
  { value: 'active', label: 'active' },
  { value: 'suspended', label: 'suspended' },
];

export default async function SuperadminPage() {
  await requireSuperadmin();
  const admin = createAdminClient();

  const [{ data: tenants }, { data: requests }] = await Promise.all([
    admin.from('tenants').select('*').order('created_at', { ascending: false }),
    admin.from('tenant_requests').select('*').order('created_at', { ascending: false }).limit(20),
  ]);

  return (
    <div className="superadmin-page">
      <header className="marketing-header">
        <div className="marketing-brand"><strong>Superadmin</strong></div>
        <nav>
          <Link href="/">Marketing</Link>
          <Link href="/login">Abmelden</Link>
        </nav>
      </header>

      <section className="panel form-panel">
        <h2>Mandanten anlegen</h2>
        <form action={createTenant} className="input-form">
          <div className="input-form-core">
            <label>Slug (Subdomain)<input name="slug" required placeholder="musterbetrieb" /></label>
            <label>Firmenname<input name="name" required /></label>
            <label>Admin E-Mail<input name="admin_email" type="email" required /></label>
            <label>Admin Passwort<input name="admin_password" type="password" required minLength={8} /></label>
            <label>Admin Vorname<input name="admin_first_name" required /></label>
            <label>Admin Nachname<input name="admin_last_name" required /></label>
          </div>
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Mandant erstellen</button>
          </div>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Alle Mandanten</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th className="data-table-col--optional">Slug</th><th>Status</th><th className="data-table-col--optional">Plan</th><th>Aktion</th><th>App</th></tr></thead>
            <tbody>
              {(tenants ?? []).map((tenant) => (
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
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Anfragen (Marketing)</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Datum</th><th>Firma</th><th className="data-table-col--optional">Kontakt</th><th>E-Mail</th><th>Status</th></tr></thead>
            <tbody>
              {(requests ?? []).map((req) => (
                <tr key={req.id}>
                  <td>{new Date(req.created_at).toLocaleDateString('de-DE')}</td>
                  <td>{req.company_name}</td>
                  <td className="data-table-col--optional">{req.contact_name}</td>
                  <td>{req.contact_email}</td>
                  <td>{req.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
