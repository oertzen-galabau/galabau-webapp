'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import type { TenantEquipmentKind, TenantEquipmentStatus } from '@/lib/types/database';
import {
  deletePrivateFile,
  EQUIPMENT_PHOTOS_BUCKET,
  uploadEquipmentPhoto,
} from '@/lib/supabase/storage';
import { partnerSettingsListPath } from '@/lib/partners/paths';

const EQUIPMENT_PATH = partnerSettingsListPath('fahrzeuge');

function requireEquipmentManage(ctx: Awaited<ReturnType<typeof getActionContext>>) {
  if (!canAccess(ctx, 'partners.manage')) throw new Error('Keine Berechtigung');
}

function parseKind(raw: FormDataEntryValue | null): TenantEquipmentKind {
  const v = String(raw ?? '');
  if (v === 'vehicle' || v === 'equipment' || v === 'trailer') return v;
  throw new Error('Ungültiger Typ');
}

function parseStatus(raw: FormDataEntryValue | null): TenantEquipmentStatus {
  const v = String(raw ?? 'active');
  if (v === 'active' || v === 'workshop' || v === 'retired') return v;
  return 'active';
}

function readOptionalInt(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function readOptionalDecimal(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return n;
}

function readOptionalDate(raw: FormDataEntryValue | null): string | null {
  const s = String(raw ?? '').trim();
  return s || null;
}

function readEquipmentFields(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Bezeichnung ist erforderlich');
  return {
    kind: parseKind(formData.get('kind')),
    name,
    build_year: readOptionalInt(formData.get('build_year')),
    serial_number: String(formData.get('serial_number') ?? '').trim() || null,
    inventory_number: String(formData.get('inventory_number') ?? '').trim() || null,
    uvv_due_date: readOptionalDate(formData.get('uvv_due_date')),
    license_plate: String(formData.get('license_plate') ?? '').trim() || null,
    manufacturer_model: String(formData.get('manufacturer_model') ?? '').trim() || null,
    inspection_due_date: readOptionalDate(formData.get('inspection_due_date')),
    operating_hours: readOptionalDecimal(formData.get('operating_hours')),
    mileage_km: readOptionalDecimal(formData.get('mileage_km')),
    license_class_required: String(formData.get('license_class_required') ?? '').trim() || null,
    status: parseStatus(formData.get('status')),
    notes: String(formData.get('notes') ?? '').trim() || null,
  };
}

async function applyPhotoFromForm(
  tenantId: string,
  equipmentId: string,
  formData: FormData,
  existingPath: string | null,
): Promise<string | null> {
  const photo = formData.get('photo');
  if (!(photo instanceof File) || photo.size === 0) return existingPath;
  if (existingPath) {
    await deletePrivateFile(tenantId, EQUIPMENT_PHOTOS_BUCKET, existingPath);
  }
  return uploadEquipmentPhoto(tenantId, equipmentId, photo);
}

export async function createEquipment(formData: FormData) {
  const ctx = await getActionContext();
  requireEquipmentManage(ctx);
  const { tenantId } = ctx;
  const supabase = await createClient();
  const fields = readEquipmentFields(formData);

  const { data, error } = await supabase
    .from('tenant_equipment')
    .insert({
      tenant_id: tenantId,
      ...fields,
      is_active: true,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const photoPath = await applyPhotoFromForm(tenantId, data.id, formData, null);
  if (photoPath) {
    const { error: photoError } = await supabase
      .from('tenant_equipment')
      .update({ photo_path: photoPath, updated_at: new Date().toISOString() })
      .eq('id', data.id)
      .eq('tenant_id', tenantId);
    if (photoError) throw new Error(photoError.message);
  }

  revalidatePath(EQUIPMENT_PATH);
}

export async function updateEquipment(formData: FormData) {
  const ctx = await getActionContext();
  requireEquipmentManage(ctx);
  const { tenantId } = ctx;

  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('Eintrag fehlt');

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('tenant_equipment')
    .select('photo_path')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!existing) throw new Error('Eintrag nicht gefunden');

  const fields = readEquipmentFields(formData);
  const photoPath = await applyPhotoFromForm(tenantId, id, formData, existing.photo_path);

  const { error } = await supabase
    .from('tenant_equipment')
    .update({
      ...fields,
      photo_path: photoPath,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);

  revalidatePath(EQUIPMENT_PATH);
}

export async function setEquipmentActive(formData: FormData) {
  const ctx = await getActionContext();
  requireEquipmentManage(ctx);
  const { tenantId } = ctx;

  const id = String(formData.get('id') ?? '');
  const isActive = formData.get('is_active') === 'true';
  if (!id) throw new Error('Eintrag fehlt');

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenant_equipment')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);

  revalidatePath(EQUIPMENT_PATH);
}
