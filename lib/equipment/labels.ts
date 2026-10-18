import { addDays } from '@/lib/schedule/week';
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

export type UvvUrgency = 'overdue' | 'within_4_weeks' | 'within_8_weeks' | 'later';

const UVV_URGENCY_SORT: Record<UvvUrgency, number> = {
  overdue: 0,
  within_4_weeks: 1,
  within_8_weeks: 2,
  later: 3,
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

export function uvvUrgency(uvvDueDate: string | null, todayIso: string): UvvUrgency | null {
  if (!uvvDueDate) return null;
  if (uvvDueDate < todayIso) return 'overdue';
  const within4WeeksEnd = addDays(todayIso, 28);
  const within8WeeksEnd = addDays(todayIso, 56);
  if (uvvDueDate <= within4WeeksEnd) return 'within_4_weeks';
  if (uvvDueDate <= within8WeeksEnd) return 'within_8_weeks';
  return 'later';
}

export function uvvUrgencyCssClass(urgency: UvvUrgency | null): string | undefined {
  if (!urgency || urgency === 'later') return undefined;
  if (urgency === 'overdue') return 'equipment-uvv-overdue';
  if (urgency === 'within_4_weeks') return 'equipment-uvv-within-4w';
  return 'equipment-uvv-within-8w';
}

export function uvvUrgencyJobMarkerClass(urgency: UvvUrgency | null): string {
  if (urgency === 'overdue') return 'job-marker equipment-uvv-marker-overdue';
  if (urgency === 'within_4_weeks') return 'job-marker travel';
  if (urgency === 'within_8_weeks') return 'job-marker equipment-uvv-marker-8w';
  return 'job-marker';
}

export function compareUvvDueEntries(
  a: { uvvDueDate: string; urgency: UvvUrgency },
  b: { uvvDueDate: string; urgency: UvvUrgency },
): number {
  const rankDiff = UVV_URGENCY_SORT[a.urgency] - UVV_URGENCY_SORT[b.urgency];
  if (rankDiff !== 0) return rankDiff;
  return a.uvvDueDate.localeCompare(b.uvvDueDate);
}

export function isUvvOverdue(uvvDueDate: string | null, todayIso: string): boolean {
  return uvvUrgency(uvvDueDate, todayIso) === 'overdue';
}
