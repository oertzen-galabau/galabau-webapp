import Link from 'next/link';
import { InvitationActivationForm } from '@/components/auth/invitation-activation-form';
import { getInvitationPreview } from '@/lib/actions/employee-invitation';

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitationPage({ params }: PageProps) {
  const { token } = await params;
  const preview = await getInvitationPreview(token);

  if (!preview) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 style={{ marginTop: 0 }}>Einladung ungültig</h1>
          <p className="muted">
            Dieser Einladungslink ist ungültig, abgelaufen oder wurde bereits verwendet.
            Bitte wenden Sie sich an Ihre Verwaltung, um neue Zugangsdaten zu erhalten.
          </p>
          <p className="auth-footer">
            <Link href="/login">Zur Anmeldung</Link>
          </p>
        </div>
      </div>
    );
  }

  return <InvitationActivationForm token={token} preview={preview} />;
}
