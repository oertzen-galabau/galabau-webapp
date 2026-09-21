'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { seedTenantRoles } from '@/lib/tenant/roles';
import { seedPayrollDefaults } from '@/lib/payroll/tenant-rules';

export type RegisterPlan = 'solo' | 'team' | 'max';

export type RegisterInput = {
  companyName: string;
  slug: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  plan: RegisterPlan;
};

export type RegisterResult =
  | { ok: true; slug: string; email: string }
  | { ok: false; error: string };

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const VALID_PLANS: RegisterPlan[] = ['solo', 'team', 'max'];

function adminConfigError(error: unknown): RegisterResult | null {
  if (error instanceof Error && error.message.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    return { ok: false, error: 'Server-Konfiguration unvollständig (Admin-Zugriff).' };
  }
  return null;
}

async function rollbackRegistration(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  userId?: string,
) {
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
  await admin.from('tenants').delete().eq('id', tenantId);
}

export async function registerTenant(input: RegisterInput): Promise<RegisterResult> {
  const slug = input.slug.toLowerCase().trim();
  const name = input.companyName.trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  const plan = VALID_PLANS.includes(input.plan) ? input.plan : 'team';

  if (!name || !firstName || !lastName || !email || !input.password) {
    return { ok: false, error: 'Bitte füllen Sie alle Pflichtfelder aus.' };
  }

  if (input.password.length < 8) {
    return { ok: false, error: 'Das Passwort muss mindestens 8 Zeichen lang sein.' };
  }

  if (!SLUG_PATTERN.test(slug)) {
    return {
      ok: false,
      error: 'Die Subdomain darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.',
    };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    return adminConfigError(error) ?? { ok: false, error: 'Registrierung derzeit nicht verfügbar.' };
  }

  try {
    const { data: existing } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle();
    if (existing) {
      return { ok: false, error: 'Diese Subdomain ist bereits vergeben.' };
    }

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({
        slug,
        name,
        status: 'trial',
        plan,
        default_start_password: input.password,
      })
      .select('id')
      .single();

    if (tenantError || !tenant) {
      return { ok: false, error: tenantError?.message ?? 'Firma konnte nicht angelegt werden.' };
    }

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });

    if (authError || !authUser.user) {
      await admin.from('tenants').delete().eq('id', tenant.id);
      if (authError?.message?.toLowerCase().includes('already')) {
        return { ok: false, error: 'Diese E-Mail-Adresse ist bereits registriert.' };
      }
      return { ok: false, error: authError?.message ?? 'Benutzer konnte nicht angelegt werden.' };
    }

    try {
      await seedPayrollDefaults(admin, tenant.id);
      const roleIds = await seedTenantRoles(admin, tenant.id);
      const adminRoleId = roleIds.get('administrator');
      if (!adminRoleId) {
        await rollbackRegistration(admin, tenant.id, authUser.user.id);
        return { ok: false, error: 'Administrator-Rolle konnte nicht angelegt werden.' };
      }

      const { error: profileError } = await admin
        .from('profiles')
        .update({
          tenant_id: tenant.id,
          tenant_role_id: adminRoleId,
          role: 'administrator',
          first_name: firstName,
          last_name: lastName,
          email,
        })
        .eq('id', authUser.user.id);

      if (profileError) {
        await rollbackRegistration(admin, tenant.id, authUser.user.id);
        return { ok: false, error: profileError.message };
      }
    } catch (error) {
      await rollbackRegistration(admin, tenant.id, authUser.user.id);
      if (error instanceof Error) {
        return { ok: false, error: error.message };
      }
      return { ok: false, error: 'Mandant konnte nicht vollständig eingerichtet werden.' };
    }

    return { ok: true, slug, email };
  } catch (error) {
    return adminConfigError(error) ?? { ok: false, error: 'Registrierung fehlgeschlagen. Bitte später erneut versuchen.' };
  }
}
