import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

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

/** Chat-Benachrichtigung auch ohne messages.send (Service-Role), z. B. Urlaubs-Workflow. */
export async function insertDirectMessageTrusted(params: {
  tenantId: string;
  senderId: string;
  recipientId: string;
  body: string;
}): Promise<void> {
  const trimmed = params.body.trim();
  if (!trimmed || params.senderId === params.recipientId) return;

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    console.error('[messages] insertDirectMessageTrusted: kein Service-Role-Key', err);
    throw err;
  }

  const { error } = await admin.from('messages').insert({
    tenant_id: params.tenantId,
    sender_id: params.senderId,
    recipient_id: params.recipientId,
    body: trimmed,
  });
  if (error) throw new Error(error.message);
}

export async function insertDirectMessageWithFallback(
  supabase: SupabaseClient,
  params: {
    tenantId: string;
    senderId: string;
    recipientId: string;
    body: string;
  },
): Promise<void> {
  try {
    await insertDirectMessage(supabase, params);
  } catch (userErr) {
    console.error('[messages] insertDirectMessage failed, retry trusted', userErr);
    await insertDirectMessageTrusted(params);
  }
}
