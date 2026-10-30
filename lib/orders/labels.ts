import type { ClothingStatus } from '@/lib/types/database';

export const ORDER_STATUS_LABELS: Record<ClothingStatus, string> = {
  pending: 'Offen',
  ordered: 'Bestellt',
  delivered: 'Geliefert',
};

export function orderStatusBadgeClass(status: ClothingStatus): string {
  if (status === 'pending') return 'travel';
  if (status === 'ordered') return 'active';
  return 'active';
}

export function formatOrderEuro(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
}
