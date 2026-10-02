'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MoreVertical, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { markConversationUnread } from '@/lib/actions/employee';
import { displayName, initials } from '@/lib/auth/roles';
import {
  conversationListPreview,
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
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [markingUnreadId, setMarkingUnreadId] = useState<string | null>(null);

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

  const { unreadContacts, otherContacts } = useMemo(() => {
    const unread: ContactWithSummary[] = [];
    const other: ContactWithSummary[] = [];
    for (const contact of filteredContacts) {
      if ((contact.unreadCount ?? 0) > 0) unread.push(contact);
      else other.push(contact);
    }
    return { unreadContacts: unread, otherContacts: other };
  }, [filteredContacts]);

  useEffect(() => {
    const supabase = createClient();
    const refreshList = () => {
      router.refresh();
    };
    const channel = supabase
      .channel(`chat-sidebar:${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${currentUserId}`,
        },
        refreshList,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${currentUserId}`,
        },
        refreshList,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, router]);

  function renderContactRow(contact: ContactWithSummary) {
    const isActive = activeContactId === contact.id;
    const hasConversation = Boolean(contact.lastMessageAt);
    const unreadCount = contact.unreadCount ?? 0;
    const preview = hasConversation
      ? conversationListPreview(contact, currentUserId)
      : 'Neuer Chat';
    const timeLabel = contact.lastMessageAt
      ? formatChatListTime(
          unreadCount > 0 && contact.latestUnreadAt
            ? contact.latestUnreadAt
            : contact.lastMessageAt,
        )
      : '';

    return (
      <div
        key={contact.id}
        className={`chat-sidebar-row${isActive ? ' chat-sidebar-row--active' : ''}${unreadCount > 0 ? ' chat-sidebar-row--unread' : ''}`}
      >
        <Link
          href={`/app/nachrichten/${contact.id}`}
          className={`chat-sidebar-item${isActive ? ' chat-sidebar-item--active' : ''}${unreadCount > 0 ? ' chat-sidebar-item--unread' : ''}`}
        >
          <span className="chat-avatar">{initials(contact)}</span>
          <span className="chat-sidebar-item-body">
            <span className="chat-sidebar-item-top">
              <strong>{displayName(contact)}</strong>
              {timeLabel && <small>{timeLabel}</small>}
            </span>
            <span className="chat-sidebar-item-bottom">
              <span className="chat-sidebar-preview">{preview}</span>
              {unreadCount > 0 && (
                <span className="chat-unread-badge" aria-label={`${unreadCount} ungelesen`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
          </span>
        </Link>
        {hasConversation && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              className="chat-sidebar-item-menu-trigger"
              aria-label={`Aktionen für ${displayName(contact)}`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreVertical size={16} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={markingUnreadId === contact.id}
                onClick={() => void handleMarkUnread(contact.id)}
              >
                Als ungelesen markieren
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }

  async function handleMarkUnread(contactId: string) {
    setMarkingUnreadId(contactId);
    try {
      await markConversationUnread(contactId);
      router.refresh();
    } finally {
      setMarkingUnreadId(null);
    }
  }

  return (
    <div className={`chat-shell${activeContactId ? ' chat-shell--chat-open' : ''}`}>
      <aside className="chat-sidebar">
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
          {unreadContacts.length > 0 && (
            <div className="chat-sidebar-section">
              <p className="chat-sidebar-section-label">
                Ungelesen
                <span className="chat-sidebar-section-count">{unreadContacts.length}</span>
              </p>
              {unreadContacts.map(renderContactRow)}
            </div>
          )}
          {otherContacts.length > 0 && (
            <div className="chat-sidebar-section">
              {unreadContacts.length > 0 && (
                <p className="chat-sidebar-section-label">Alle Chats</p>
              )}
              {otherContacts.map(renderContactRow)}
            </div>
          )}
        </div>
      </aside>

      <section className="chat-main">
        {children}
      </section>
    </div>
  );
}
