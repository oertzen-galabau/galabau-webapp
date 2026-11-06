'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import { partnerSettingsListPath } from '@/lib/partners/paths';

const EQUIPMENT_PATH = partnerSettingsListPath('fahrzeuge');
const EQUIPMENT_TYPES_PATH = partnerSettingsListPath('typen');

function revalidateEquipmentTypeViews() {
  revalidatePath(EQUIPMENT_PATH);
  revalidatePath(EQUIPMENT_TYPES_PATH);
}

function requireEquipmentManage(ctx: Awaited<ReturnType<typeof getActionContext>>) {
  if (!canAccess(ctx, 'partners.manage')) throw new Error('Keine Berechtigung');
}

function equipmentTypeDbError(error: { code?: string; message?: string }): string {
  const msg = error.message ?? 'Speichern fehlgeschlagen';
  if (error.code === '23505') return 'Dieser Typname existiert bereits.';
  if (error.code === '23503') return 'Typ wird noch von Einträgen verwendet und kann nicht gelöscht werden.';
  return msg;
}

export async function createEquipmentType(formData: FormData) {
  const ctx = await getActionContext();
  requireEquipmentManage(ctx);
  const { tenantId } = ctx;

  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Bezeichnung ist erforderlich');

  const supabase = await createClient();
  const { error } = await supabase.from('tenant_equipment_types').insert({
    tenant_id: tenantId,
    name,
    sort_order: 0,
  });
  if (error) throw new Error(equipmentTypeDbError(error));

  revalidateEquipmentTypeViews();
}

export async function updateEquipmentType(formData: FormData) {
  const ctx = await getActionContext();
  requireEquipmentManage(ctx);
  const { tenantId } = ctx;

  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  if (!id || !name) throw new Error('Ungültige Eingabe');

  const isActive = formData.get('is_active') === 'on';

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenant_equipment_types')
    .update({
      name,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(equipmentTypeDbError(error));

  revalidateEquipmentTypeViews();
}

export async function deleteEquipmentType(formData: FormData) {
  const ctx = await getActionContext();
  requireEquipmentManage(ctx);
  const { tenantId } = ctx;

  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Typ fehlt');

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from('tenant_equipment')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('equipment_type_id', id);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) > 0) {
    throw new Error('Typ wird noch von Einträgen verwendet. Bitte zuerst zuweisen oder Einträge löschen.');
  }

  const { error } = await supabase
    .from('tenant_equipment_types')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(equipmentTypeDbError(error));

  revalidateEquipmentTypeViews();
}
