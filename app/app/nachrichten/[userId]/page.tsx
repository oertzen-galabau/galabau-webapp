import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { markConversationRead } from '@/lib/actions/employee';
import { ChatPanel } from '@/components/messages/chat-panel';
import type { Message, Profile } from '@/lib/types/database';

export default async function NachrichtenChatPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: contactId } = await params;
  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.nachrichten')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  if (contactId === ctx.userId) notFound();

  const supabase = await createClient();
  const [{ data: contact }, { data: messages }] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, tenant_roles(name)')
      .eq('id', contactId)
      .eq('tenant_id', ctx.tenant!.id)
      .eq('is_active', true)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${ctx.userId},recipient_id.eq.${contactId}),and(sender_id.eq.${contactId},recipient_id.eq.${ctx.userId})`,
      )
      .order('created_at', { ascending: true }),
  ]);

  if (!contact) notFound();

  await markConversationRead(contactId);

  const profile = contact as Profile & { tenant_roles?: { name: string } | null };

  return (
    <ChatPanel
      currentUserId={ctx.userId}
      contact={{
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        job_title: profile.job_title,
        roleName: profile.tenant_roles?.name ?? null,
      }}
      initialMessages={(messages ?? []) as Message[]}
    />
  );
}
