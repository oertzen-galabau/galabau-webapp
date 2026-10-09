'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { PermissionKey } from '@/lib/auth/permissions';
import { canAccess, getActionContext } from '@/lib/auth/session';
import {
  cartTotalEur,
  lineTotalEur,
  splitOrderTotal,
  type CartLineInput,
} from '@/lib/orders/budget';
import { resolveItemSizeOptions } from '@/lib/orders/catalog-sizes';
import { loadClothingOrderBudgetBreakdown } from '@/lib/orders/load-budget';
import { loadOrderCatalogSizePresets } from '@/lib/orders/load-size-presets';
import { createClient } from '@/lib/supabase/server';
import type { ClothingStatus, OrderCatalogCategorySizeKind, OrderCatalogItem } from '@/lib/types/database';

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

const statusSchema = z.enum(['pending', 'ordered', 'delivered']);

type ParsedLine = {
  catalogItemId: string;
  quantity: number;
  size: string;
  namePrint: string | null;
};

function parseCartLines(formData: FormData): ParsedLine[] {
  const ids = formData.getAll('catalog_item_id[]').map(String);
  const quantities = formData.getAll('quantity[]').map((v) => Number(v));
  const sizes = formData.getAll('size[]').map((v) => String(v).trim());
  const namePrints = formData.getAll('name_print[]').map((v) => String(v).trim());

  const lines: ParsedLine[] = [];
  for (let i = 0; i < ids.length; i++) {
    const quantity = quantities[i] ?? 0;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const size = sizes[i] ?? '';
    if (!size) throw new Error('Bitte für jeden Artikel eine Größe angeben.');
    const namePrintRaw = namePrints[i] ?? '';
    lines.push({
      catalogItemId: ids[i],
      quantity: Math.floor(quantity),
      size,
      namePrint: namePrintRaw || null,
    });
  }
  if (lines.length === 0) throw new Error('Bitte mindestens einen Artikel mit Menge bestellen.');
  return lines;
}

function revalidateOrderPaths(userId?: string) {
  revalidatePath('/app/bestellungen');
  if (userId) revalidatePath(`/app/team/${userId}`);
  revalidatePath('/app/profil');
}

export async function submitCatalogOrder(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.create');
  const { tenantId, userId } = ctx;

  const parsedLines = parseCartLines(formData);
  const notes = (formData.get('notes') as string | null)?.trim() || null;
  const year = new Date().getFullYear();

  const supabase = await createClient();
  const catalogIds = [...new Set(parsedLines.map((l) => l.catalogItemId))];

  const [catalogResult, sizePresets] = await Promise.all([
    supabase
      .from('order_catalog_items')
      .select('*, order_catalog_categories(name, size_kind)')
      .eq('tenant_id', tenantId)
      .in('id', catalogIds),
    loadOrderCatalogSizePresets(supabase, tenantId),
  ]);
  if (catalogResult.error) throw new Error(catalogResult.error.message);
  const catalogItems = catalogResult.data ?? [];

  type CatalogRow = OrderCatalogItem & {
    order_catalog_categories: { name: string; size_kind: OrderCatalogCategorySizeKind } | null;
  };

  const byId = new Map((catalogItems as CatalogRow[]).map((item) => [item.id, item]));
  for (const line of parsedLines) {
    const item = byId.get(line.catalogItemId);
    if (!item) throw new Error('Katalogartikel nicht gefunden.');
    if (!item.is_active) throw new Error(`Artikel „${item.clothing_style}“ ist nicht mehr aktiv.`);
    const sizeKind = item.order_catalog_categories?.size_kind ?? 'clothing';
    const allowed = resolveItemSizeOptions(item, sizeKind, sizePresets);
    if (allowed.length === 0) {
      throw new Error(`Für „${item.clothing_style}“ sind keine Größen hinterlegt.`);
    }
    if (!allowed.includes(line.size)) {
      throw new Error(`Größe „${line.size}“ ist für „${item.clothing_style}“ nicht hinterlegt.`);
    }
  }

  const cartInputs: CartLineInput[] = parsedLines.map((line) => {
    const item = byId.get(line.catalogItemId)!;
    return { unitPriceEur: item.price != null ? Number(item.price) : null, quantity: line.quantity };
  });
  const totalEur = cartTotalEur(cartInputs);

  const budget = await loadClothingOrderBudgetBreakdown(supabase, tenantId, userId, year);
  const { budgetCoveredEur, ownShareEur } = splitOrderTotal(totalEur, budget.remainingEur);

  const { data: order, error: orderError } = await supabase
    .from('catalog_orders')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      status: 'pending',
      total_eur: totalEur,
      budget_covered_eur: budgetCoveredEur,
      own_share_eur: ownShareEur,
      budget_year: year,
      notes,
    })
    .select('id')
    .single();
  if (orderError || !order) throw new Error(orderError?.message ?? 'Bestellung konnte nicht gespeichert werden.');

  const rows = parsedLines.map((line, index) => {
    const item = byId.get(line.catalogItemId)! as OrderCatalogItem & {
      order_catalog_categories: { name: string } | null;
    };
    const unitPrice = item.price != null ? Number(item.price) : null;
    return {
      order_id: order.id,
      tenant_id: tenantId,
      catalog_item_id: item.id,
      category_name: item.order_catalog_categories?.name ?? '—',
      article_number: item.article_number,
      clothing_style: item.clothing_style,
      series: item.series,
      unit_price_eur: unitPrice,
      size: line.size,
      quantity: line.quantity,
      name_print: line.namePrint,
      line_total_eur: lineTotalEur(unitPrice, line.quantity),
      sort_order: index,
    };
  });

  const { error: linesError } = await supabase.from('catalog_order_items').insert(rows);
  if (linesError) {
    await supabase.from('catalog_orders').delete().eq('id', order.id);
    throw new Error(linesError.message);
  }

  revalidateOrderPaths(userId);
}

export async function cancelCatalogOrder(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.create');
  const orderId = z.string().uuid().parse(formData.get('order_id'));

  const supabase = await createClient();
  const { error } = await supabase
    .from('catalog_orders')
    .delete()
    .eq('id', orderId)
    .eq('user_id', ctx.userId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
  revalidateOrderPaths(ctx.userId);
}

/** Anzahl neuer (offener) Bestellungen – nur für Nutzer mit `orders.manage`. */
export async function getPendingOrderCount(): Promise<number> {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'nav.bestellungen') || !canAccess(ctx, 'orders.manage')) return 0;

  const supabase = await createClient();
  const { count, error } = await supabase
    .from('catalog_orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenantId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function updateCatalogOrderStatus(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.manage');
  const { tenantId } = ctx;

  const orderId = z.string().uuid().parse(formData.get('order_id'));
  const status = statusSchema.parse(formData.get('status'));

  const supabase = await createClient();
  const { error } = await supabase
    .from('catalog_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  revalidateOrderPaths();
}

export async function updateDefaultClothingOrderBudget(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.manage_budget');
  const { tenantId } = ctx;

  const raw = (formData.get('default_clothing_order_budget_eur') as string | null)?.trim();
  const value = raw === '' || raw == null ? null : Number(raw.replace(',', '.'));
  if (value != null && (!Number.isFinite(value) || value < 0)) {
    throw new Error('Ungültiger Budgetbetrag.');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({ default_clothing_order_budget_eur: value })
    .eq('id', tenantId);
  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app/bestellungen');
}

export async function updateEmployeeClothingOrderBudget(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.manage_budget');
  const { tenantId } = ctx;

  const userId = z.string().uuid().parse(formData.get('user_id'));
  const year = Number(formData.get('year') ?? new Date().getFullYear());
  const budgetEur = Number(formData.get('budget_eur') ?? 0);
  if (!Number.isFinite(year) || year < 2000) throw new Error('Ungültiges Jahr.');
  if (!Number.isFinite(budgetEur) || budgetEur < 0) throw new Error('Ungültiger Budgetbetrag.');

  const supabase = await createClient();
  const { error } = await supabase.from('clothing_order_budgets').upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      year,
      budget_eur: budgetEur,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,user_id,year' },
  );
  if (error) throw new Error(error.message);
  revalidateOrderPaths(userId);
}
