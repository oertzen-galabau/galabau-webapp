import type { SupabaseClient } from '@supabase/supabase-js';

export async function insertDirectMessage(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    senderId: string;
    recipientId: string;
    body: string;
  },
): Promise<void> {
  const trimmed = params.body.trim();
  if (!trimmed || params.senderId === params.recipientId) return;

  const { error } = await supabase.from('messages').insert({
    tenant_id: params.tenantId,
    sender_id: params.senderId,
    recipient_id: params.recipientId,
    body: trimmed,
  });
  if (error) throw new Error(error.message);
}
