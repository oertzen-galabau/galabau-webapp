'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { canAccess, getActionContext } from '@/lib/auth/session';
import type { SiteFormState } from '@/lib/actions/admin';

async function ensureSiteTeamMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  siteId: string,
  userId: string | null,
) {
  if (!userId) return;
  const { data: existing } = await supabase
    .from('site_team_members')
    .select('id')
    .eq('site_id', siteId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from('site_team_members').insert({
    tenant_id: tenantId,
    site_id: siteId,
    user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function updateSiteLeads(formData: FormData) {
  const ctx = await getActionContext();
  if (!canAccess(ctx, 'sites.assign_team')) throw new Error('Keine Berechtigung');

  const siteId = (formData.get('site_id') as string)?.trim();
  if (!siteId) throw new Error('Baustelle fehlt');

  const siteManagerRaw = (formData.get('site_manager_user_id') as string)?.trim();
  const foremanRaw = (formData.get('responsible_user_id') as string)?.trim();
  const site_manager_user_id = siteManagerRaw || null;
  const responsible_user_id = foremanRaw || null;

  const supabase = await createClient();

  const { data: site } = await supabase
    .from('sites')
    .select('id')
    .eq('id', siteId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  if (!site) throw new Error('Baustelle nicht gefunden.');

  for (const userId of [site_manager_user_id, responsible_user_id]) {
    if (!userId) continue;
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .eq('tenant_id', ctx.tenantId)
      .eq('is_active', true)
      .maybeSingle();
    if (!profile) throw new Error('Gewählte Person nicht gefunden oder inaktiv.');
  }

  const { error } = await supabase
    .from('sites')
    .update({ site_manager_user_id, responsible_user_id })
    .eq('id', siteId)
    .eq('tenant_id', ctx.tenantId);
  if (error) throw new Error(error.message);

  await ensureSiteTeamMember(supabase, ctx.tenantId, siteId, site_manager_user_id);
  await ensureSiteTeamMember(supabase, ctx.tenantId, siteId, responsible_user_id);

  revalidatePath(`/app/baustellen/${siteId}`);
  revalidatePath('/app/baustellen');
}

export async function updateSiteLeadsAction(
  _prev: SiteFormState | null,
  formData: FormData,
): Promise<SiteFormState> {
  try {
    await updateSiteLeads(formData);
    return { ok: true, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Speichern fehlgeschlagen';
    return { ok: false, error: message };
  }
}

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

  await ensureSiteTeamMember(supabase, ctx.tenantId, siteId, userId);

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
    .select('id, site_id, user_id')
    .eq('id', memberId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  if (!row) throw new Error('Zuweisung nicht gefunden.');

  const { error } = await supabase.from('site_team_members').delete().eq('id', memberId);
  if (error) throw new Error(error.message);

  const { data: site } = await supabase
    .from('sites')
    .select('site_manager_user_id, responsible_user_id')
    .eq('id', row.site_id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle();
  if (site) {
    const patch: { site_manager_user_id?: null; responsible_user_id?: null } = {};
    if (site.site_manager_user_id === row.user_id) patch.site_manager_user_id = null;
    if (site.responsible_user_id === row.user_id) patch.responsible_user_id = null;
    if (Object.keys(patch).length) {
      await supabase.from('sites').update(patch).eq('id', row.site_id).eq('tenant_id', ctx.tenantId);
    }
  }

  revalidatePath(`/app/baustellen/${row.site_id}`);
  revalidatePath('/app/baustellen');
}
