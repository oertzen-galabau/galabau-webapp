import { Suspense } from 'react';
import { requireSuperadmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { FeedbackAdminPanel } from '@/components/feedback/feedback-admin-panel';
import { listFeedbackReportsForSuperadmin } from '@/lib/actions/feedback';
import { SuperadminRequestsPanel } from '@/components/superadmin/superadmin-requests-panel';
import { SuperadminShell } from '@/components/superadmin/superadmin-shell';
import { SuperadminTenantsPanel } from '@/components/superadmin/superadmin-tenants-panel';
import type { Tenant } from '@/lib/types/database';

export default async function SuperadminPage() {
  await requireSuperadmin();
  const admin = createAdminClient();

  const [{ data: tenants }, { data: requests }, feedbackRows] = await Promise.all([
    admin.from('tenants').select('*').order('created_at', { ascending: false }),
    admin.from('tenant_requests').select('*').order('created_at', { ascending: false }).limit(20),
    listFeedbackReportsForSuperadmin(),
  ]);

  const feedbackOpenCount = feedbackRows.filter((r) => r.status === 'open').length;

  return (
    <Suspense fallback={<div className="superadmin-page muted superadmin-loading">Laden…</div>}>
      <SuperadminShell
        feedbackOpenCount={feedbackOpenCount}
        mandanten={<SuperadminTenantsPanel tenants={(tenants ?? []) as Tenant[]} />}
        feedback={<FeedbackAdminPanel initialRows={feedbackRows} />}
        anfragen={<SuperadminRequestsPanel requests={requests ?? []} />}
      />
    </Suspense>
  );
}
