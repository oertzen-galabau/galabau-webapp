import type { SupabaseClient } from '@supabase/supabase-js';
import type { CatalogOrder, CatalogOrderItem } from '@/lib/types/database';
import { catalogSumFromItems } from '@/lib/orders/form-rows';

export type OrderFormSheet = {
  orderId: string;
  employeeName: string;
  orderDateIso: string;
  items: CatalogOrderItem[];
  catalogSumEur: number;
};

export type LoadedOrderFormData = {
  tenantName: string;
  sheets: OrderFormSheet[];
};

type OrderRow = CatalogOrder & {
  catalog_order_items: CatalogOrderItem[];
  profiles: { first_name: string; last_name: string } | null;
};

export async function loadOrderFormData(
  supabase: SupabaseClient,
  tenantId: string,
  orderIds: string[],
): Promise<LoadedOrderFormData> {
  const uniqueIds = [...new Set(orderIds)];
  if (uniqueIds.length === 0) throw new Error('Keine Bestellungen ausgewählt.');

  const [{ data: tenant }, { data: orders, error }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('catalog_orders')
      .select('*, catalog_order_items(*), profiles(first_name, last_name)')
      .eq('tenant_id', tenantId)
      .in('id', uniqueIds),
  ]);

  if (error) throw new Error(error.message);
  const rows = (orders ?? []) as OrderRow[];
  if (rows.length !== uniqueIds.length) {
    throw new Error('Eine oder mehrere Bestellungen wurden nicht gefunden.');
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  const sheets: OrderFormSheet[] = uniqueIds.map((id) => {
    const order = byId.get(id)!;
    const items = [...(order.catalog_order_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const employeeName = order.profiles
      ? `${order.profiles.first_name} ${order.profiles.last_name}`.trim()
      : '—';
    return {
      orderId: order.id,
      employeeName,
      orderDateIso: order.created_at,
      items,
      catalogSumEur: catalogSumFromItems(items),
    };
  });

  return {
    tenantName: tenant?.name ?? 'Bestellung',
    sheets,
  };
}
