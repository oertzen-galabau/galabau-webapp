'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';

function normalizeLabel(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? '').trim();
  return value || null;
}

export async function saveTenantReportLabels(formData: FormData) {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'settings.branding')) {
    throw new Error('Keine Berechtigung');
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('tenants')
    .update({
      daily_report_label: normalizeLabel(formData.get('daily_report_label')),
      hourly_wage_rapport_label: normalizeLabel(formData.get('hourly_wage_rapport_label')),
    })
    .eq('id', ctx.tenantId);

  if (error) throw new Error(error.message);

  revalidatePath('/app/einstellungen');
  revalidatePath('/app/dokumentation');
  revalidatePath('/app/rapporte');
}
