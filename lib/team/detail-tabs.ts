import type { PermissionKey } from '@/lib/auth/permissions';

export const EMPLOYEE_TABS = [
  { id: 'overview', label: 'Übersicht', permission: 'team.view' as PermissionKey },
  { id: 'stammdaten', label: 'Stammdaten', permission: 'team.view' as PermissionKey },
  { id: 'rolle', label: 'Rolle & Zugriff', permission: 'team.view' as PermissionKey },
  { id: 'urlaub', label: 'Urlaub', permission: 'team.view' as PermissionKey },
  { id: 'zeiten', label: 'Zeiten', permission: 'team.view' as PermissionKey },
  { id: 'einsatz', label: 'Einsatz', permission: 'team.view' as PermissionKey },
  { id: 'bestellungen', label: 'Bestellungen', permission: 'team.view' as PermissionKey },
  { id: 'notizen', label: 'Notizen', permission: 'team.notes' as PermissionKey },
] as const;

export type EmployeeTabId = (typeof EMPLOYEE_TABS)[number]['id'];

export function isEmployeeTab(value: string | undefined): value is EmployeeTabId {
  return EMPLOYEE_TABS.some((t) => t.id === value);
}

export function visibleEmployeeTabs(permissions: Set<PermissionKey>, isSuperadminBypass: boolean) {
  return EMPLOYEE_TABS.filter((tab) => {
    if (isSuperadminBypass) return true;
    return permissions.has(tab.permission);
  });
}
