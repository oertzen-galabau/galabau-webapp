import type { Message, Profile } from '@/lib/types/database';
import { truncatePreview } from '@/lib/messages/format';

export type ChatContact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  roleName: string | null;
};

export type ConversationSummary = {
  contactId: string;
  lastMessage: string;
  lastMessageAt: string;
  lastMessageSenderId: string;
  unreadCount: number;
  /** Neueste ungelesene eingehende Nachricht (für Listen-Vorschau). */
  latestUnreadMessage?: string;
  latestUnreadAt?: string;
};

export function buildConversationSummaries(
  messages: Message[],
  currentUserId: string,
): ConversationSummary[] {
  const byContact = new Map<string, ConversationSummary>();

  for (const msg of messages) {
    const contactId = msg.sender_id === currentUserId ? msg.recipient_id : msg.sender_id;
    const existing = byContact.get(contactId);
    const isIncoming = msg.recipient_id === currentUserId;
    const isUnread = isIncoming && !msg.read_at;

    if (!existing) {
      byContact.set(contactId, {
        contactId,
        lastMessage: msg.body,
        lastMessageAt: msg.created_at,
        lastMessageSenderId: msg.sender_id,
        unreadCount: isUnread ? 1 : 0,
        ...(isUnread
          ? { latestUnreadMessage: msg.body, latestUnreadAt: msg.created_at }
          : {}),
      });
      continue;
    }

    if (isUnread) {
      existing.unreadCount += 1;
      if (!existing.latestUnreadMessage) {
        existing.latestUnreadMessage = msg.body;
        existing.latestUnreadAt = msg.created_at;
      }
    }
  }

  return [...byContact.values()].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

export function mergeContactsWithConversations(
  members: ChatContact[],
  summaries: ConversationSummary[],
  currentUserId: string,
): Array<ChatContact & Partial<ConversationSummary>> {
  const summaryByContact = new Map(summaries.map((s) => [s.contactId, s]));
  const withConversation = summaries
    .map((summary) => {
      const member = members.find((m) => m.id === summary.contactId);
      if (!member) return null;
      return { ...member, ...summary };
    })
    .filter(Boolean) as Array<ChatContact & ConversationSummary>;

  withConversation.sort((a, b) => {
    const aUnread = a.unreadCount > 0 ? 1 : 0;
    const bUnread = b.unreadCount > 0 ? 1 : 0;
    if (bUnread !== aUnread) return bUnread - aUnread;
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });

  const withoutConversation = members
    .filter((m) => m.id !== currentUserId && !summaryByContact.has(m.id))
    .map((member) => ({
      ...member,
      lastMessage: '',
      lastMessageAt: '',
      lastMessageSenderId: '',
      unreadCount: 0,
    }))
    .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'de'));

  return [...withConversation, ...withoutConversation];
}

export function profileToChatContact(
  profile: Profile & { tenant_roles?: { name: string } | null },
): ChatContact {
  return {
    id: profile.id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
    job_title: profile.job_title,
    roleName: profile.tenant_roles?.name ?? null,
  };
}

export function conversationPreview(
  summary: Pick<ConversationSummary, 'lastMessage' | 'lastMessageSenderId'>,
  currentUserId: string,
) {
  if (!summary.lastMessage) return 'Noch keine Nachrichten';
  const prefix = summary.lastMessageSenderId === currentUserId ? 'Du: ' : '';
  return `${prefix}${truncatePreview(summary.lastMessage)}`;
}

export function conversationListPreview(
  contact: {
    unreadCount?: number;
    latestUnreadMessage?: string;
    lastMessage?: string;
    lastMessageSenderId?: string;
  },
  currentUserId: string,
) {
  if ((contact.unreadCount ?? 0) > 0 && contact.latestUnreadMessage) {
    return truncatePreview(contact.latestUnreadMessage);
  }
  return conversationPreview(
    {
      lastMessage: contact.lastMessage ?? '',
      lastMessageSenderId: contact.lastMessageSenderId ?? '',
    },
    currentUserId,
  );
}
