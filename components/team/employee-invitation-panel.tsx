'use client';

import { useActionState } from 'react';
import {
  getInvitationStatus,
  invitationStatusLabel,
  type InvitationStatus,
} from '@/lib/auth/employee-invitations';
import {
  regenerateEmployeeInvite,
  resendEmployeeInvitationEmail,
  revokePendingEmployeeInvitation,
  type EmployeeInviteResult,
  type EmployeeInvitationMailActionResult,
} from '@/lib/actions/admin';
import { EmployeeInviteCredentials } from '@/components/team/employee-invite-credentials';
import type { EmployeeInvitation } from '@/lib/types/database';

type Props = {
  memberId: string;
  memberName: string;
  mustChangePassword: boolean;
  invitation: EmployeeInvitation | null;
  canManageInvites: boolean;
};

const initialState: EmployeeInviteResult | null = null;
const initialMailState: EmployeeInvitationMailActionResult | null = null;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EmployeeInvitationPanel({
  memberId,
  memberName,
  mustChangePassword,
  invitation,
  canManageInvites,
}: Props) {
  const [state, action, pending] = useActionState(regenerateEmployeeInvite, initialState);
  const [resendState, resendAction, resendPending] = useActionState(
    resendEmployeeInvitationEmail,
    initialMailState,
  );
  const [revokeState, revokeAction, revokePending] = useActionState(
    revokePendingEmployeeInvitation,
    initialMailState,
  );

  const status: InvitationStatus | 'none' = invitation
    ? getInvitationStatus(invitation)
    : 'none';

  return (
    <div className="employee-invitation-panel">
      <h4 className="employee-invitation-title">Einladung & Erstlogin</h4>

      {mustChangePassword ? (
        <p className="muted">
          Erstlogin ausstehend — {memberName} muss noch ein persönliches Passwort festlegen.
          {status === 'expired' && (
            <> Die letzte Einladung ist abgelaufen; erzeugen Sie neue Zugangsdaten.</>
          )}
          {' '}
          Link oder Einmalpasswort vergessen? Nutzen Sie unten „Neue Zugangsdaten erzeugen“ — der alte Link wird
          ungültig.
        </p>
      ) : (
        <p className="muted">Erstlogin abgeschlossen.</p>
      )}

      {invitation && (
        <dl className="invite-credentials-list">
          <div>
            <dt>Status</dt>
            <dd>{status === 'none' ? 'Keine Einladung' : invitationStatusLabel(status)}</dd>
          </div>
          <div>
            <dt>Erstellt am</dt>
            <dd>{formatDate(invitation.created_at)}</dd>
          </div>
          <div>
            <dt>Gültig bis</dt>
            <dd>{formatDate(invitation.expires_at)}</dd>
          </div>
        </dl>
      )}

      {state?.ok && (
        <EmployeeInviteCredentials
          title="Neue Zugangsdaten"
          result={state}
        />
      )}

      {state && !state.ok && (
        <p className="form-error">{state.error}</p>
      )}

      {resendState?.ok && <p className="form-success">{resendState.message}</p>}
      {resendState && !resendState.ok && <p className="form-error">{resendState.error}</p>}
      {revokeState?.ok && <p className="form-success">{revokeState.message}</p>}
      {revokeState && !revokeState.ok && <p className="form-error">{revokeState.error}</p>}

      {canManageInvites && mustChangePassword && (
        <div className="inline-actions employee-invitation-actions" style={{ marginTop: 12, flexWrap: 'wrap', gap: '8px 16px' }}>
          {invitation && (status === 'pending' || status === 'expired') && (
            <>
              {status === 'pending' && (
                <form action={resendAction} className="inline-actions" style={{ display: 'inline' }}>
                  <input type="hidden" name="user_id" value={memberId} />
                  <button type="submit" className="text-button" disabled={resendPending || pending || revokePending}>
                    {resendPending ? 'E-Mail wird gesendet…' : 'Einladung erneut per E-Mail'}
                  </button>
                </form>
              )}
              <form action={revokeAction} className="inline-actions" style={{ display: 'inline' }}>
                <input type="hidden" name="user_id" value={memberId} />
                <button type="submit" className="text-button" disabled={revokePending || pending || resendPending}>
                  {revokePending ? 'Wird widerrufen…' : 'Ausstehende Einladung widerrufen'}
                </button>
              </form>
            </>
          )}
          <form action={action} className="inline-actions" style={{ display: 'inline' }}>
            <input type="hidden" name="user_id" value={memberId} />
            <button type="submit" className="text-button" disabled={pending || resendPending || revokePending}>
              {pending ? 'Wird erzeugt…' : 'Neue Zugangsdaten erzeugen'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
