import type { SupabaseClient } from '@supabase/supabase-js';

export async function markIncomingMessagesRead(
  supabase: SupabaseClient,
  params: { recipientUserId: string; senderUserId: string },
): Promise<string | null> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('messages')
    .update({ delivered_at: now, read_at: now })
    .eq('sender_id', params.senderUserId)
    .eq('recipient_id', params.recipientUserId)
    .is('read_at', null);
  return error?.message ?? null;
}

export async function markInboxDeliveredForUser(
  supabase: SupabaseClient,
  recipientUserId: string,
): Promise<string | null> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('messages')
    .update({ delivered_at: now })
    .eq('recipient_id', recipientUserId)
    .is('delivered_at', null);
  return error?.message ?? null;
}
