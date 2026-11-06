import { EmployeeDetailHeader } from '@/components/team/employee-detail-header';
import { EmployeeDetailTabs } from '@/components/team/employee-detail-tabs';
import { EmployeeTabPanel } from '@/components/team/employee-tab-panels';
import type { EmployeeDetailLoadResult } from '@/lib/team/employee-detail-data';
import type { SessionContext } from '@/lib/auth/session';
import { canAccess } from '@/lib/auth/session';
import { visibleEmployeeTabs, type EmployeeTabId } from '@/lib/team/detail-tabs';

type Props = {
  data: EmployeeDetailLoadResult;
  ctx: SessionContext;
  activeTab: EmployeeTabId;
  month: string;
  selectedYear: number;
};

export function EmployeeDetailView({ data, ctx, activeTab, month, selectedYear }: Props) {
  const { member, roleName, tabBasePath, tenantRoles, invitation, mode } = data;

  const canEditSelf = canAccess(ctx, 'profile.edit_self');
  const canChangeEmail = canAccess(ctx, 'profile.change_email');
  const canChangePassword = canAccess(ctx, 'profile.change_password');

  const tabs = visibleEmployeeTabs(mode, ctx.permissions, ctx.isSuperadminBypass);

  return (
    <>
      <EmployeeDetailHeader member={member} roleName={roleName} mode={mode} />
      <EmployeeDetailTabs
        tabBasePath={tabBasePath}
        tabs={tabs}
        activeTab={activeTab}
        month={month}
      />
      <EmployeeTabPanel
        tab={activeTab}
        mode={mode}
        tabBasePath={tabBasePath}
        member={member}
        roleName={roleName}
        tenantRoles={tenantRoles}
        ctx={{
          userId: ctx.userId,
          permissions: ctx.permissions,
          isSuperadminBypass: ctx.isSuperadminBypass,
        }}
        year={selectedYear}
        month={month}
        balance={data.leaveContext.balance}
        leaveBreakdown={data.leaveContext.breakdown}
        carriedOverSource={data.leaveContext.carriedOverSource}
        carryExpiry={data.leaveContext.carryExpiry}
        leaveRequests={data.leaveRequests}
        yearTimeEntries={data.yearTimeEntries}
        zeitenMonthEntries={data.monthTimeEntries}
        assignments={data.assignments}
        orders={data.orders}
        catalogOrders={data.catalogOrders}
        orderBudgetBreakdown={data.orderBudgetBreakdown}
        employeeOrderBudgetEur={data.employeeOrderBudgetEur}
        notes={data.notes}
        monthMinutes={data.monthMinutes}
        pendingLeaveCount={data.pendingLeaveCount}
        todayAssignment={data.todayAssignment}
        invitation={invitation}
        workAreas={data.workAreas}
        profileSecurity={{
          email: member.email,
          canChangeEmail,
          canChangePassword,
        }}
        personalEditableSelf={canEditSelf}
      />
    </>
  );
}
