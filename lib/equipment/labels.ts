import type { TenantEquipmentKind, TenantEquipmentStatus } from '@/lib/types/database';

export const EQUIPMENT_KIND_LABELS: Record<TenantEquipmentKind, string> = {
  vehicle: 'Fahrzeug',
  equipment: 'Gerät',
  trailer: 'Anhänger',
};

export const EQUIPMENT_STATUS_LABELS: Record<TenantEquipmentStatus, string> = {
  active: 'Aktiv',
  workshop: 'Werkstatt',
  retired: 'Ausgemustert',
};

export function equipmentListSubtitle(item: {
  license_plate: string | null;
  inventory_number: string | null;
}): string {
  const parts: string[] = [];
  if (item.license_plate?.trim()) parts.push(item.license_plate.trim());
  if (item.inventory_number?.trim()) parts.push(`Inv. ${item.inventory_number.trim()}`);
  return parts.join(' · ');
}

export function equipmentScheduleLabel(item: {
  name: string;
  license_plate: string | null;
  inventory_number: string | null;
}): string {
  const sub = equipmentListSubtitle(item);
  return sub ? `${item.name} (${sub})` : item.name;
}

export function isUvvOverdue(uvvDueDate: string | null, todayIso: string): boolean {
  if (!uvvDueDate) return false;
  return uvvDueDate < todayIso;
}
