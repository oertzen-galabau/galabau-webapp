import { createClient } from '@/lib/supabase/server';

export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}
