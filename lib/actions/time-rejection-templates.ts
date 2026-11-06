'use server';

import { revalidatePath } from 'next/cache';
import { canAccess, getActionContext } from '@/lib/auth/session';

function requireApprove(ctx: Awaited<ReturnType<typeof getActionContext>>) {
  if (!canAccess(ctx, 'zeiten.approve')) throw new Error('Keine Berechtigung.');
}

export async function saveTimeRejectionTemplate(formData: FormData) {
  const ctx = await getActionContext();
  requireApprove(ctx);
  const { tenantId } = ctx;

  const label = ((formData.get('label') as string) ?? '').trim();
  const body = ((formData.get('body') as string) ?? '').trim();
  if (!label) throw new Error('Bitte einen Namen für die Vorlage angeben.');
  if (!body) throw new Error('Der Vorlagentext darf nicht leer sein.');

  const sortOrderRaw = Number(formData.get('sort_order'));
  const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0;

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { error } = await supabase.from('time_rejection_templates').insert({
    tenant_id: tenantId,
    label,
    body,
    sort_order: sortOrder,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Es gibt bereits eine Vorlage mit diesem Namen.');
    }
    throw new Error(error.message);
  }

  revalidatePath('/app/zeiten/freigabe');
}

export async function deleteTimeRejectionTemplate(formData: FormData) {
  const ctx = await getActionContext();
  requireApprove(ctx);
  const { tenantId } = ctx;

  const id = formData.get('id') as string;
  if (!id) throw new Error('Vorlage nicht gefunden.');

  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { error } = await supabase
    .from('time_rejection_templates')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) throw new Error(error.message);
  revalidatePath('/app/zeiten/freigabe');
}
