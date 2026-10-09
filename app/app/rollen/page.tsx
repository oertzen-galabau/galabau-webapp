import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getTenantIdForSession, requireTenantMember } from '@/lib/auth/session';
import { createTenantRole } from '@/lib/actions/permissions';

export default async function RollenPage() {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'roles.manage')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const tenantId = await getTenantIdForSession(ctx);
  if (!tenantId) {
    return <p className="muted">Kein Mandant.</p>;
  }

  const supabase = await createClient();

  const [{ data: roles }, { data: memberCounts }] = await Promise.all([
    supabase.from('tenant_roles').select('*').eq('tenant_id', tenantId).order('sort_order'),
    supabase.from('profiles').select('tenant_role_id').eq('tenant_id', tenantId),
  ]);

  const countByRole = new Map<string, number>();
  for (const m of memberCounts ?? []) {
    if (m.tenant_role_id) {
      countByRole.set(m.tenant_role_id, (countByRole.get(m.tenant_role_id) ?? 0) + 1);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Verwaltung</span>
          <h1>Rollen & Berechtigungen</h1>
          <p>Rollen anlegen und festlegen, welche Funktionen sichtbar und nutzbar sind.</p>
        </div>
      </div>

      <section className="panel form-panel">
        <h2>Neue Rolle</h2>
        <form action={createTenantRole} className="input-form">
          <div className="input-form-core">
            <label>Name<input name="name" required placeholder="z. B. Buchhaltung" /></label>
          </div>
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Rolle anlegen</button>
          </div>
        </form>
      </section>

      <section className="panel roles-list roles-list--links" style={{ marginTop: 16 }}>
        <h2>Rollen</h2>
        {(roles ?? []).map((role) => (
          <Link href={`/app/rollen/${role.id}`} className="roles-row roles-row--link" key={role.id}>
            <div>
              <strong>{role.name}</strong>
              <small>
                {role.is_system ? 'System-Rolle' : 'Eigene Rolle'} · {countByRole.get(role.id) ?? 0} Mitarbeiter
              </small>
            </div>
            <span className={`status-badge ${role.is_system ? 'travel' : 'active'}`}>
              {role.is_system ? 'System' : 'Eigene'}
            </span>
          </Link>
        ))}
      </section>
    </>
  );
}
