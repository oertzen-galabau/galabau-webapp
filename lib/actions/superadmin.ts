'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSuperadmin } from '@/lib/auth/session';
import { seedTenantRoles } from '@/lib/tenant/roles';

export async function createTenant(formData: FormData) {
  await requireSuperadmin();
  const admin = createAdminClient();

  const slug = (formData.get('slug') as string).toLowerCase().trim();
  const name = formData.get('name') as string;
  const adminEmail = formData.get('admin_email') as string;
  const adminPassword = formData.get('admin_password') as string;
  const firstName = formData.get('admin_first_name') as string;
  const lastName = formData.get('admin_last_name') as string;

  const { data: tenant, error: tenantError } = await admin.from('tenants').insert({
    slug,
    name,
    status: 'trial',
  }).select('*').single();

  if (tenantError || !tenant) throw new Error(tenantError?.message ?? 'Tenant Fehler');

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  });

  if (authError || !authUser.user) {
    await admin.from('tenants').delete().eq('id', tenant.id);
    throw new Error(authError?.message ?? 'Admin-User Fehler');
  }

  const roleIds = await seedTenantRoles(admin, tenant.id);
  const adminRoleId = roleIds.get('administrator');
  if (!adminRoleId) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    await admin.from('tenants').delete().eq('id', tenant.id);
    throw new Error('Administrator-Rolle konnte nicht angelegt werden');
  }

  const { error: profileError } = await admin.from('profiles').update({
    tenant_id: tenant.id,
    tenant_role_id: adminRoleId,
    role: 'administrator',
    first_name: firstName,
    last_name: lastName,
    email: adminEmail,
  }).eq('id', authUser.user.id);

  if (profileError) throw new Error(profileError.message);

  revalidatePath('/superadmin');
}

export async function updateTenantStatus(formData: FormData) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const { error } = await admin.from('tenants').update({
    status: formData.get('status') as string,
  }).eq('id', formData.get('id') as string);
  if (error) throw new Error(error.message);
  revalidatePath('/superadmin');
}
