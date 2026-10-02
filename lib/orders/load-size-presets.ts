import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_CLOTHING_SIZES,
  DEFAULT_SHOE_SIZES,
  type SizePresetsMap,
} from '@/lib/orders/catalog-sizes';
import type { OrderCatalogSizeKind } from '@/lib/types/database';

function sortSizes(rows: { value: string; sort_order: number }[]): string[] {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.value.localeCompare(b.value, 'de')).map((r) => r.value);
}

async function seedDefaultsIfEmpty(
  supabase: SupabaseClient,
  tenantId: string,
  kind: OrderCatalogSizeKind,
  defaults: readonly string[],
) {
  const { count } = await supabase
    .from('order_catalog_size_options')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('kind', kind);
  if ((count ?? 0) > 0) return;

  const rows = defaults.map((value, index) => ({
    tenant_id: tenantId,
    kind,
    value,
    sort_order: (index + 1) * 10,
  }));
  await supabase.from('order_catalog_size_options').insert(rows);
}

export async function loadOrderCatalogSizePresets(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<SizePresetsMap> {
  await seedDefaultsIfEmpty(supabase, tenantId, 'clothing', DEFAULT_CLOTHING_SIZES);
  await seedDefaultsIfEmpty(supabase, tenantId, 'shoes', DEFAULT_SHOE_SIZES);

  const { data, error } = await supabase
    .from('order_catalog_size_options')
    .select('kind, value, sort_order')
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);

  const clothingRows = (data ?? []).filter((r) => r.kind === 'clothing');
  const shoeRows = (data ?? []).filter((r) => r.kind === 'shoes');

  return {
    clothing: sortSizes(clothingRows).length ? sortSizes(clothingRows) : [...DEFAULT_CLOTHING_SIZES],
    shoes: sortSizes(shoeRows).length ? sortSizes(shoeRows) : [...DEFAULT_SHOE_SIZES],
  };
}
