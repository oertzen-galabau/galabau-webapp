'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { displayName, initials } from '@/lib/auth/roles';
import {
  conversationPreview,
  type ChatContact,
  type ConversationSummary,
} from '@/lib/messages/conversations';
import { formatChatListTime } from '@/lib/messages/format';

type ContactWithSummary = ChatContact & Partial<ConversationSummary>;

type Props = {
  currentUserId: string;
  contacts: ContactWithSummary[];
  children: React.ReactNode;
};

export function ChatShell({ currentUserId, contacts, children }: Props) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');

  const activeContactId = pathname.startsWith('/app/nachrichten/')
    ? pathname.split('/app/nachrichten/')[1]?.split('/')[0] ?? null
    : null;

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((contact) => {
      const name = displayName(contact).toLowerCase();
      const role = (contact.roleName ?? '').toLowerCase();
      return name.includes(q) || role.includes(q) || contact.email.toLowerCase().includes(q);
    });
  }, [contacts, query]);

  return (
    <div className={`chat-shell${activeContactId ? ' chat-shell--chat-open' : ''}`}>
      <aside className={`chat-sidebar${activeContactId ? ' chat-sidebar--hidden-mobile' : ''}`}>
        <div className="chat-sidebar-head">
          <h1>Nachrichten</h1>
        </div>
        <div className="chat-sidebar-search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen oder neuen Chat beginnen"
            aria-label="Chats durchsuchen"
          />
        </div>
        <div className="chat-sidebar-list">
          {filteredContacts.length === 0 && (
            <p className="chat-sidebar-empty muted">Keine Kontakte gefunden.</p>
          )}
          {filteredContacts.map((contact) => {
            const isActive = activeContactId === contact.id;
            const hasConversation = Boolean(contact.lastMessageAt);
            const preview = hasConversation
              ? conversationPreview(
                  {
                    lastMessage: contact.lastMessage ?? '',
                    lastMessageSenderId: contact.lastMessageSenderId ?? '',
                  },
                  currentUserId,
                )
              : 'Neuer Chat';
            const timeLabel = contact.lastMessageAt
              ? formatChatListTime(contact.lastMessageAt)
              : '';

            return (
              <Link
                key={contact.id}
                href={`/app/nachrichten/${contact.id}`}
                className={`chat-sidebar-item${isActive ? ' chat-sidebar-item--active' : ''}${(contact.unreadCount ?? 0) > 0 ? ' chat-sidebar-item--unread' : ''}`}
              >
                <span className="chat-avatar">{initials(contact)}</span>
                <span className="chat-sidebar-item-body">
                  <span className="chat-sidebar-item-top">
                    <strong>{displayName(contact)}</strong>
                    {timeLabel && <small>{timeLabel}</small>}
                  </span>
                  <span className="chat-sidebar-item-bottom">
                    <span className="chat-sidebar-preview">{preview}</span>
                    {(contact.unreadCount ?? 0) > 0 && (
                      <span className="chat-unread-badge">{contact.unreadCount}</span>
                    )}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </aside>

      <section className={`chat-main${activeContactId ? ' chat-main--visible-mobile' : ''}`}>
        {children}
      </section>
    </div>
  );
}
