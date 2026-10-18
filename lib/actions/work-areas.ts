'use server';

import { revalidatePath } from 'next/cache';
import { canAccess, getActionContext } from '@/lib/auth/session';

function requireWorkAreasManage(ctx: Awaited<ReturnType<typeof getActionContext>>) {
  if (!canAccess(ctx, 'settings.work_areas')) throw new Error('Keine Berechtigung');
}

export async function createWorkArea(formData: FormData) {
  const ctx = await getActionContext();
  requireWorkAreasManage(ctx);
  const { tenantId } = ctx;

  const name = ((formData.get('name') as string) ?? '').trim();
  if (!name) throw new Error('Name ist erforderlich');

  const scheduleAssignable = formData.get('schedule_assignable') === 'on';
  const sortOrderRaw = Number(formData.get('sort_order'));
  const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 50;

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { error } = await supabase.from('tenant_work_areas').insert({
    tenant_id: tenantId,
    name,
    sort_order: sortOrder,
    schedule_assignable: scheduleAssignable,
  });

  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app/einsatzplanung');
  revalidatePath('/app/team');
}

export async function updateWorkArea(formData: FormData) {
  const ctx = await getActionContext();
  requireWorkAreasManage(ctx);
  const { tenantId } = ctx;

  const id = formData.get('id') as string;
  const name = ((formData.get('name') as string) ?? '').trim();
  if (!id || !name) throw new Error('Ungültige Eingabe');

  const isActive = formData.get('is_active') === 'on';
  const scheduleAssignable = formData.get('schedule_assignable') === 'on';
  const sortOrder = Number(formData.get('sort_order'));

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { error } = await supabase
    .from('tenant_work_areas')
    .update({
      name,
      is_active: isActive,
      schedule_assignable: scheduleAssignable,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 50,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app/einsatzplanung');
  revalidatePath('/app/team');
}

export async function setWorkAreaScheduleAssignable(formData: FormData) {
  const ctx = await getActionContext();
  requireWorkAreasManage(ctx);
  const { tenantId } = ctx;

  const id = formData.get('id') as string;
  if (!id) throw new Error('Ungültige Eingabe');

  const scheduleAssignable = formData.get('schedule_assignable') === 'on';

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { error } = await supabase
    .from('tenant_work_areas')
    .update({
      schedule_assignable: scheduleAssignable,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw new Error(error.message);
  revalidatePath('/app/einstellungen');
  revalidatePath('/app/einsatzplanung');
  revalidatePath('/app/team');
}
