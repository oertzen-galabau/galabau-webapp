import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { markInboxDeliveredForUser } from '@/lib/messages/read-state';
import { ChatShell } from '@/components/messages/chat-shell';
import {
  buildConversationSummaries,
  mergeContactsWithConversations,
  profileToChatContact,
} from '@/lib/messages/conversations';
import type { Message, Profile } from '@/lib/types/database';

export default async function NachrichtenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.nachrichten')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const supabase = await createClient();

  if (canAccess(ctx, 'messages.send')) {
    const deliveredError = await markInboxDeliveredForUser(supabase, ctx.userId);
    if (deliveredError) {
      console.error('[nachrichten] markInboxDelivered failed', {
        userId: ctx.userId,
        error: deliveredError,
      });
    }
  }
  const [{ data: members }, { data: messages }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, tenant_roles(name)')
      .eq('tenant_id', ctx.tenant!.id)
      .eq('is_active', true)
      .order('last_name'),
    supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${ctx.userId},recipient_id.eq.${ctx.userId}`)
      .order('created_at', { ascending: false }),
  ]);

  const contacts = mergeContactsWithConversations(
    (members ?? [])
      .filter((m) => m.id !== ctx.userId)
      .map((m) => profileToChatContact(m as Profile & { tenant_roles?: { name: string } | null })),
    buildConversationSummaries((messages ?? []) as Message[], ctx.userId),
    ctx.userId,
  );

  return (
    <ChatShell currentUserId={ctx.userId} contacts={contacts}>
      {children}
    </ChatShell>
  );
}
