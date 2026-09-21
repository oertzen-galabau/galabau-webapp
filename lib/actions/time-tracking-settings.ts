'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import type { PermissionKey } from '@/lib/auth/permissions';
import { DEFAULT_TIME_TRACKING_RULES } from '@/lib/time-tracking/break-rules';

function requirePerm(ctx: Awaited<ReturnType<typeof getActionContext>>, key: PermissionKey) {
  if (!canAccess(ctx, key)) throw new Error('Keine Berechtigung');
}

function parseBoolean(value: FormDataEntryValue | null) {
  return value === 'on' || value === 'true';
}

function parseMinutes(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function saveTenantTimeTrackingRules(formData: FormData) {
  const ctx = await getActionContext();
  requirePerm(ctx, 'settings.time_tracking');

  const supabase = await createClient();
  const payload = {
    tenant_id: ctx.tenantId,
    breakfast_enabled: parseBoolean(formData.get('breakfast_enabled')),
    breakfast_min_work_minutes: parseMinutes(
      formData.get('breakfast_min_work_minutes'),
      DEFAULT_TIME_TRACKING_RULES.breakfast_min_work_minutes,
    ),
    breakfast_expected_minutes: parseMinutes(
      formData.get('breakfast_expected_minutes'),
      DEFAULT_TIME_TRACKING_RULES.breakfast_expected_minutes,
    ),
    breakfast_window_start: String(formData.get('breakfast_window_start') || DEFAULT_TIME_TRACKING_RULES.breakfast_window_start),
    breakfast_window_end: String(formData.get('breakfast_window_end') || DEFAULT_TIME_TRACKING_RULES.breakfast_window_end),
    lunch_enabled: parseBoolean(formData.get('lunch_enabled')),
    lunch_min_work_minutes: parseMinutes(
      formData.get('lunch_min_work_minutes'),
      DEFAULT_TIME_TRACKING_RULES.lunch_min_work_minutes,
    ),
    lunch_expected_minutes: parseMinutes(
      formData.get('lunch_expected_minutes'),
      DEFAULT_TIME_TRACKING_RULES.lunch_expected_minutes,
    ),
    lunch_window_start: String(formData.get('lunch_window_start') || DEFAULT_TIME_TRACKING_RULES.lunch_window_start),
    lunch_window_end: String(formData.get('lunch_window_end') || DEFAULT_TIME_TRACKING_RULES.lunch_window_end),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('tenant_time_tracking_rules').upsert(payload, {
    onConflict: 'tenant_id',
  });
  if (error) throw new Error(error.message);

  revalidatePath('/app/einstellungen');
  revalidatePath('/app/zeiten');
}
