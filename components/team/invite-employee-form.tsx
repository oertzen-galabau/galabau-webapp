'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { inviteEmployee, type EmployeeInviteResult } from '@/lib/actions/admin';
import { AppSelect } from '@/components/ui/app-select';
import { EmployeeInviteCredentials } from '@/components/team/employee-invite-credentials';
import { WorkAreaSelect } from '@/components/team/work-area-select';
import type { TenantWorkArea } from '@/lib/types/database';

type RoleOption = { value: string; label: string };

const initialState: EmployeeInviteResult | null = null;

export function InviteEmployeeForm({
  roles,
  workAreas,
}: {
  roles: RoleOption[];
  workAreas: Pick<TenantWorkArea, 'id' | 'name' | 'is_active'>[];
}) {
  const [state, action, pending] = useActionState(inviteEmployee, initialState);

  return (
    <section className="panel form-panel">
      <h2>Mitarbeiter anlegen</h2>
      <p className="muted">
        Nach dem Anlegen erhalten Sie einen individuellen Einladungslink und ein Einmalpasswort zum Kopieren.
        Optional wird dieselbe Einladung per E-Mail versendet, sobald SMTP konfiguriert ist.
      </p>

      {state?.ok && (
        <>
          <EmployeeInviteCredentials
            title="Zugangsdaten für den neuen Mitarbeiter"
            result={state}
          />
          <p className="muted" style={{ marginBottom: 16 }}>
            <Link href={`/app/team/${state.userId}?tab=rolle`} className="text-button">
              Zum Mitarbeiterprofil
            </Link>
          </p>
        </>
      )}

      {state && !state.ok && (
        <p className="form-error">{state.error}</p>
      )}

      <form action={action} className="input-form">
        <div className="input-form-core">
          <label>Vorname<input name="first_name" required /></label>
          <label>Nachname<input name="last_name" required /></label>
          <label>Berufbezeichnung<input name="job_title" placeholder="z.B. Vorarbeiter, Gärtner" /></label>
          <label>
            Bereich (Einsatzplan)
            <WorkAreaSelect areas={workAreas} />
          </label>
          <label>E-Mail<input name="email" type="email" required autoComplete="off" /></label>
          <label>Rolle
            <AppSelect
              name="tenant_role_id"
              required
              allowEmpty={false}
              options={roles}
            />
          </label>
        </div>
        <div className="input-form-actions">
          <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
            {pending ? 'Wird angelegt…' : 'Anlegen'}
          </button>
        </div>
      </form>
    </section>
  );
}
