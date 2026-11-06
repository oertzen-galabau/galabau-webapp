'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import type { TenantEquipmentStatus } from '@/lib/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  deletePrivateFile,
  EQUIPMENT_PHOTOS_BUCKET,
  uploadEquipmentPhoto,
} from '@/lib/supabase/storage';
import { partnerSettingsListPath } from '@/lib/partners/paths';

const EQUIPMENT_PATH = partnerSettingsListPath('fahrzeuge');

export type EquipmentFormState = { error: string | null; ok?: boolean };

function equipmentActionError(err: unknown): EquipmentFormState {
  return {
    error: err instanceof Error ? err.message : 'Speichern fehlgeschlagen',
    ok: false,
  };
}

function readPhotoFromForm(formData: FormData): File | null {
  const photo = formData.get('photo');
  if (typeof photo !== 'object' || photo === null || !('size' in photo)) return null;
  const size = photo.size;
  if (typeof size !== 'number' || size <= 0) return null;
  return photo as File;
}

function requireEquipmentManage(ctx: Awaited<ReturnType<typeof getActionContext>>) {
  if (!canAccess(ctx, 'partners.manage')) throw new Error('Keine Berechtigung');
}

async function resolveEquipmentTypeId(
  supabase: SupabaseClient,
  tenantId: string,
  raw: FormDataEntryValue | null,
): Promise<string> {
  const id = String(raw ?? '').trim();
  if (!id) throw new Error('Typ ist erforderlich');

  const { data, error } = await supabase
    .from('tenant_equipment_types')
    .select('id, is_active')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error || !data) throw new Error('Typ nicht gefunden');
  if (!data.is_active) throw new Error('Typ ist inaktiv');
  return id;
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

const BOOKING_NUMBER_MAX_LEN = 50;

function equipmentDbErrorMessage(error: { code?: string; message?: string }): string {
  const msg = error.message ?? 'Speichern fehlgeschlagen';
  if (error.code === '23505' && msg.includes('tenant_equipment_tenant_inventory_uidx')) {
    return 'Diese Inventarnummer ist im Mandanten bereits vergeben.';
  }
  return msg;
}

function readOptionalBookingNumber(raw: FormDataEntryValue | null): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s.length > BOOKING_NUMBER_MAX_LEN) {
    throw new Error(`Buchungsnummer darf höchstens ${BOOKING_NUMBER_MAX_LEN} Zeichen haben.`);
  }
  return s;
}

async function readEquipmentFields(
  supabase: SupabaseClient,
  tenantId: string,
  formData: FormData,
) {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) throw new Error('Bezeichnung ist erforderlich');
  const equipment_type_id = await resolveEquipmentTypeId(
    supabase,
    tenantId,
    formData.get('equipment_type_id'),
  );
  return {
    equipment_type_id,
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
    booking_number: readOptionalBookingNumber(formData.get('booking_number')),
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
  const photo = readPhotoFromForm(formData);
  if (!photo) return existingPath;
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
  const fields = await readEquipmentFields(supabase, tenantId, formData);

  const { data, error } = await supabase
    .from('tenant_equipment')
    .insert({
      tenant_id: tenantId,
      ...fields,
      is_active: true,
    })
    .select('id')
    .single();
  if (error) throw new Error(equipmentDbErrorMessage(error));

  const photoPath = await applyPhotoFromForm(tenantId, data.id, formData, null);
  if (photoPath) {
    const { error: photoError } = await supabase
      .from('tenant_equipment')
      .update({ photo_path: photoPath, updated_at: new Date().toISOString() })
      .eq('id', data.id)
      .eq('tenant_id', tenantId);
    if (photoError) throw new Error(equipmentDbErrorMessage(photoError));
  }

  revalidatePath(EQUIPMENT_PATH);
}

export async function createEquipmentAction(
  _prev: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  try {
    await createEquipment(formData);
    return { error: null, ok: true };
  } catch (err) {
    return equipmentActionError(err);
  }
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

  const fields = await readEquipmentFields(supabase, tenantId, formData);
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
  if (error) throw new Error(equipmentDbErrorMessage(error));

  revalidatePath(EQUIPMENT_PATH);
}

export async function updateEquipmentAction(
  _prev: EquipmentFormState,
  formData: FormData,
): Promise<EquipmentFormState> {
  try {
    await updateEquipment(formData);
    return { error: null, ok: true };
  } catch (err) {
    return equipmentActionError(err);
  }
}

export async function deleteEquipment(formData: FormData) {
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

  const { error } = await supabase
    .from('tenant_equipment')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw new Error(equipmentDbErrorMessage(error));

  await deletePrivateFile(tenantId, EQUIPMENT_PHOTOS_BUCKET, existing.photo_path);

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
  if (error) throw new Error(equipmentDbErrorMessage(error));

  revalidatePath(EQUIPMENT_PATH);
}
