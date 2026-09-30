'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';

export async function addSiteTeamMember(formData: FormData) {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'sites.assign_team')) throw new Error('Keine Berechtigung');

  const siteId = (formData.get('site_id') as string)?.trim();
  const userId = (formData.get('user_id') as string)?.trim();
  if (!siteId || !userId) throw new Error('Baustelle und Mitarbeiter sind erforderlich.');

  const supabase = await createClient();

  const { data: site } = await supabase
    .from('sites')
    .select('id')
    .eq('id', siteId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  if (!site) throw new Error('Baustelle nicht gefunden.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('tenant_id', ctx.tenantId)
    .eq('is_active', true)
    .maybeSingle();
  if (!profile) throw new Error('Mitarbeiter nicht gefunden oder inaktiv.');

  const { error } = await supabase.from('site_team_members').upsert(
    {
      tenant_id: ctx.tenantId,
      site_id: siteId,
      user_id: userId,
    },
    { onConflict: 'site_id,user_id', ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/app/baustellen/${siteId}`);
  revalidatePath('/app/baustellen');
}

export async function removeSiteTeamMember(formData: FormData) {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'sites.assign_team')) throw new Error('Keine Berechtigung');

  const memberId = (formData.get('id') as string)?.trim();
  if (!memberId) throw new Error('Eintrag nicht gefunden.');

  const supabase = await createClient();

  const { data: row } = await supabase
    .from('site_team_members')
    .select('id, site_id')
    .eq('id', memberId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  if (!row) throw new Error('Zuweisung nicht gefunden.');

  const { error } = await supabase.from('site_team_members').delete().eq('id', memberId);
  if (error) throw new Error(error.message);

  revalidatePath(`/app/baustellen/${row.site_id}`);
  revalidatePath('/app/baustellen');
}
