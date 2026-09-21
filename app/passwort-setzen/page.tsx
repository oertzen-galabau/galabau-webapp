import { redirect } from 'next/navigation';
import { ForcedPasswordChangeForm } from '@/components/auth/forced-password-change-form';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function ForcedPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('must_change_password, is_active')
    .eq('id', user.id)
    .single();

  if (!profile?.is_active) {
    redirect('/login?inactive=1');
  }

  if (!profile.must_change_password) {
    redirect('/app');
  }

  return <ForcedPasswordChangeForm />;
}
