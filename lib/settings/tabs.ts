import type { PermissionKey } from '@/lib/auth/permissions';

export const SETTINGS_TABS = [
  { id: 'allgemein', label: 'Allgemein' },
  {
    id: 'lohnregeln',
    label: 'Lohnregeln & Buchungsnummern',
    permission: 'settings.payroll_rules' as PermissionKey,
  },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id'];

export function isSettingsTab(value: string | undefined): value is SettingsTabId {
  return SETTINGS_TABS.some((t) => t.id === value);
}

export function visibleSettingsTabs(
  permissions: Set<PermissionKey>,
  isSuperadminBypass: boolean,
) {
  return SETTINGS_TABS.filter((tab) => {
    if (!('permission' in tab)) return true;
    if (isSuperadminBypass) return true;
    return permissions.has(tab.permission);
  });
}
