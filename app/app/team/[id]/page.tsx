import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { EmployeeDetailView } from '@/components/team/employee-detail-view';
import { loadEmployeeDetailData } from '@/lib/team/employee-detail-data';
import { isEmployeeTab, visibleEmployeeTabs } from '@/lib/team/detail-tabs';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; month?: string }>;
};

export default async function EmployeeDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab: tabParam, month: monthParam } = await searchParams;

  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'team.view')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const tabs = visibleEmployeeTabs('admin', ctx.permissions, ctx.isSuperadminBypass);
  if (tabs.length === 0) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const activeTab =
    isEmployeeTab(tabParam) && tabs.some((t) => t.id === tabParam) ? tabParam : tabs[0].id;

  const month =
    monthParam?.match(/^\d{4}-\d{2}$/) ? monthParam : new Date().toISOString().slice(0, 7);
  const selectedYear = Number(month.slice(0, 4));

  const supabase = await createClient();
  const data = await loadEmployeeDetailData({
    supabase,
    ctx,
    mode: 'admin',
    memberIdFromRoute: id,
    activeTab,
    month,
  });

  if (!data) {
    notFound();
  }

  return <EmployeeDetailView data={data} ctx={ctx} activeTab={activeTab} month={month} selectedYear={selectedYear} />;
}
