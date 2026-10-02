import type { PermissionKey } from '@/lib/auth/permissions';

export const ORDER_TABS = [
  { id: 'bestellen', label: 'Bestellen' },
  {
    id: 'alle',
    label: 'Alle Bestellungen',
    permission: 'orders.manage' as PermissionKey,
  },
  {
    id: 'katalog',
    label: 'Katalog',
    permission: 'orders.manage_catalog' as PermissionKey,
  },
] as const;

export type OrderTabId = (typeof ORDER_TABS)[number]['id'];

export function isOrderTab(value: string | undefined): value is OrderTabId {
  return ORDER_TABS.some((t) => t.id === value);
}

export function visibleOrderTabs(
  permissions: Set<PermissionKey>,
  isSuperadminBypass: boolean,
) {
  return ORDER_TABS.filter((tab) => {
    if (!('permission' in tab)) return true;
    if (isSuperadminBypass) return true;
    return permissions.has(tab.permission);
  });
}

export const CATALOG_SUB_TABS = [
  { id: 'artikel', label: 'Artikel' },
  { id: 'kategorie', label: 'Kategorie' },
  { id: 'groessen', label: 'Größen' },
] as const;

export type CatalogSubTabId = (typeof CATALOG_SUB_TABS)[number]['id'];

export function isCatalogSubTab(value: string | undefined): value is CatalogSubTabId {
  return CATALOG_SUB_TABS.some((t) => t.id === value);
}

export function resolveCatalogSubTab(value: string | undefined): CatalogSubTabId {
  return isCatalogSubTab(value) ? value : 'artikel';
}
