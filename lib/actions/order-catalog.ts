'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { PermissionKey } from '@/lib/auth/permissions';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { normalizePriceString } from '@/lib/catalog/normalize-price';
import { createClient } from '@/lib/supabase/server';

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

const categoryNameSchema = z.string().trim().min(1, 'Name erforderlich').max(120);

const categorySizeKindSchema = z.enum(['clothing', 'shoes', 'custom']);

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  article_number: z.string().trim().max(80).optional(),
  clothing_style: z.string().trim().min(1, 'Kleidungsstil erforderlich').max(200),
  series: z.string().trim().max(120).optional(),
  price: z.number().min(0).nullable().optional(),
  shop_url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), { message: 'Ungültige Shop-URL' }),
  sizes: z.array(z.string().trim().min(1).max(40)).max(40),
  is_active: z.boolean(),
});

function parseSizesFromForm(formData: FormData): string[] {
  const fromList = formData.getAll('sizes[]').map((v) => String(v).trim()).filter(Boolean);
  if (fromList.length) return [...new Set(fromList)];
  const raw = (formData.get('sizes') as string | null)?.trim();
  if (!raw) return [];
  return [...new Set(raw.split(/[,;|/]+/).map((s) => s.trim()).filter(Boolean))];
}

function parsePriceFromForm(formData: FormData): number | null {
  const raw = (formData.get('price') as string | null)?.trim();
  if (!raw) return null;
  return normalizePriceString(raw);
}

export async function saveOrderCatalogCategory(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.manage_catalog');
  const { tenantId } = ctx;

  const name = categoryNameSchema.parse(formData.get('name'));
  const sortRaw = formData.get('sort_order');
  const sort_order = sortRaw != null && String(sortRaw).trim() !== ''
    ? Number(sortRaw)
    : 0;
  const size_kind = categorySizeKindSchema.parse(
    (formData.get('size_kind') as string | null)?.trim() || 'clothing',
  );

  const supabase = await createClient();
  const { error } = await supabase.from('order_catalog_categories').insert({
    tenant_id: tenantId,
    name,
    sort_order: Number.isFinite(sort_order) ? sort_order : 0,
    size_kind,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/app/bestellungen');
}

export async function renameOrderCatalogCategory(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.manage_catalog');

  const id = z.string().uuid().parse(formData.get('id'));
  const name = categoryNameSchema.parse(formData.get('name'));
  const sizeKindRaw = (formData.get('size_kind') as string | null)?.trim();
  const updates: { name: string; size_kind?: z.infer<typeof categorySizeKindSchema> } = { name };
  if (sizeKindRaw) {
    updates.size_kind = categorySizeKindSchema.parse(sizeKindRaw);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('order_catalog_categories')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/app/bestellungen');
}

export async function deleteOrderCatalogCategory(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.manage_catalog');

  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from('order_catalog_items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) {
    throw new Error('Kategorie wird noch von Artikeln verwendet und kann nicht gelöscht werden.');
  }

  const { error } = await supabase.from('order_catalog_categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/app/bestellungen');
}

export async function saveOrderCatalogItem(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.manage_catalog');
  const { tenantId } = ctx;

  const shopUrlRaw = (formData.get('shop_url') as string | null)?.trim() ?? '';
  const parsed = itemSchema.parse({
    id: (formData.get('id') as string | null)?.trim() || undefined,
    category_id: formData.get('category_id'),
    article_number: (formData.get('article_number') as string | null)?.trim() || undefined,
    clothing_style: formData.get('clothing_style'),
    series: (formData.get('series') as string | null)?.trim() || undefined,
    price: parsePriceFromForm(formData),
    shop_url: shopUrlRaw || undefined,
    sizes: parseSizesFromForm(formData),
    is_active: formData.get('is_active') === 'true' || formData.get('is_active') === 'on',
  });

  const row = {
    tenant_id: tenantId,
    category_id: parsed.category_id,
    article_number: parsed.article_number || null,
    clothing_style: parsed.clothing_style,
    series: parsed.series || null,
    price: parsed.price ?? null,
    shop_url: parsed.shop_url || null,
    sizes: parsed.sizes,
    is_active: parsed.is_active,
    updated_at: new Date().toISOString(),
  };

  const supabase = await createClient();
  if (parsed.id) {
    const { error } = await supabase.from('order_catalog_items').update(row).eq('id', parsed.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('order_catalog_items').insert(row);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/app/bestellungen');
}

export async function setOrderCatalogItemActive(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.manage_catalog');

  const id = z.string().uuid().parse(formData.get('id'));
  const is_active = formData.get('is_active') === 'true';

  const supabase = await createClient();
  const { error } = await supabase
    .from('order_catalog_items')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/app/bestellungen');
}

const sizeValueSchema = z.string().trim().min(1, 'Größe erforderlich').max(40);

export async function addOrderCatalogSizeOption(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.manage_catalog');
  const { tenantId } = ctx;

  const kind = z.enum(['clothing', 'shoes']).parse(formData.get('kind'));
  const value = sizeValueSchema.parse(formData.get('value'));
  const sortRaw = formData.get('sort_order');
  let sort_order = sortRaw != null && String(sortRaw).trim() !== '' ? Number(sortRaw) : NaN;

  const supabase = await createClient();
  if (!Number.isFinite(sort_order)) {
    const { data: maxRow } = await supabase
      .from('order_catalog_size_options')
      .select('sort_order')
      .eq('tenant_id', tenantId)
      .eq('kind', kind)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    sort_order = (maxRow?.sort_order ?? 0) + 10;
  }

  const { error } = await supabase.from('order_catalog_size_options').insert({
    tenant_id: tenantId,
    kind,
    value,
    sort_order,
  });
  if (error) {
    if (error.code === '23505') throw new Error('Diese Größe ist bereits hinterlegt.');
    throw new Error(error.message);
  }
  revalidatePath('/app/bestellungen');
}

export async function deleteOrderCatalogSizeOption(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'orders.manage_catalog');

  const id = z.string().uuid().parse(formData.get('id'));
  const supabase = await createClient();
  const { error } = await supabase.from('order_catalog_size_options').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/app/bestellungen');
}
