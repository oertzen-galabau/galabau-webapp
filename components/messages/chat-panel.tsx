'use client';

import Link from 'next/link';
import { ArrowLeft, Check, CheckCheck, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { displayName, initials } from '@/lib/auth/roles';
import { markConversationRead, sendChatMessage } from '@/lib/actions/employee';
import {
  formatChatDateDivider,
  formatChatTime,
  isSameChatDay,
} from '@/lib/messages/format';
import { createClient } from '@/lib/supabase/client';
import type { Message } from '@/lib/types/database';

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  roleName: string | null;
};

type Props = {
  currentUserId: string;
  contact: Contact;
  initialMessages: Message[];
};

function messageStatus(msg: Message) {
  if (msg.read_at) return 'read';
  if (msg.delivered_at) return 'delivered';
  return 'sent';
}

function StatusIcon({ status }: { status: 'sent' | 'delivered' | 'read' }) {
  if (status === 'sent') {
    return <Check size={14} className="chat-status-icon chat-status-icon--sent" aria-hidden />;
  }
  return (
    <CheckCheck
      size={14}
      className={`chat-status-icon chat-status-icon--${status}`}
      aria-hidden
    />
  );
}

export function ChatPanel({ currentUserId, contact, initialMessages }: Props) {
  const router = useRouter();
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const sortedMessages = useMemo(() => {
    const merged = new Map<string, Message>();
    for (const msg of initialMessages) merged.set(msg.id, msg);
    for (const msg of localMessages) merged.set(msg.id, msg);
    return [...merged.values()].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [initialMessages, localMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sortedMessages.length]);

  useEffect(() => {
    void markConversationRead(contact.id).catch(() => undefined);
  }, [contact.id]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${currentUserId}:${contact.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          if (incoming.sender_id !== contact.id) return;
          setLocalMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          void markConversationRead(contact.id).catch(() => undefined);
          router.refresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${currentUserId}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          if (updated.recipient_id !== contact.id) return;
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [contact.id, currentUserId, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending) return;

    setError(null);
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      tenant_id: '',
      sender_id: currentUserId,
      recipient_id: contact.id,
      body: text,
      delivered_at: null,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    setDraft('');
    setLocalMessages((prev) => [...prev, optimisticMessage]);

    startTransition(async () => {
      try {
        await sendChatMessage(contact.id, text);
        setLocalMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        router.refresh();
      } catch (err) {
        setLocalMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setDraft(text);
        setError(err instanceof Error ? err.message : 'Senden fehlgeschlagen.');
      }
    });
  }

  const subtitle = contact.job_title ?? contact.roleName ?? contact.email;

  return (
    <>
      <header className="chat-main-header">
        <Link href="/app/nachrichten" className="chat-back-button" aria-label="Zurück zur Liste">
          <ArrowLeft size={20} />
        </Link>
        <span className="chat-avatar chat-avatar--header">{initials(contact)}</span>
        <div className="chat-main-header-text">
          <strong>{displayName(contact)}</strong>
          <small>{subtitle}</small>
        </div>
      </header>

      <div className="chat-messages" ref={messagesContainerRef}>
        {sortedMessages.length === 0 && (
          <p className="chat-messages-empty muted">Noch keine Nachrichten. Schreib die erste!</p>
        )}
        {sortedMessages.map((msg, index) => {
          const prev = sortedMessages[index - 1];
          const showDateDivider = !prev || !isSameChatDay(prev.created_at, msg.created_at);
          const isOwn = msg.sender_id === currentUserId;

          return (
            <div key={msg.id}>
              {showDateDivider && (
                <div className="chat-date-divider">
                  <span>{formatChatDateDivider(msg.created_at)}</span>
                </div>
              )}
              <div className={`chat-bubble-row${isOwn ? ' chat-bubble-row--own' : ''}`}>
                <div className={`chat-bubble${isOwn ? ' chat-bubble--own' : ' chat-bubble--other'}`}>
                  <p>{msg.body}</p>
                  <div className="chat-bubble-meta">
                    <time dateTime={msg.created_at}>{formatChatTime(msg.created_at)}</time>
                    {isOwn && !msg.id.startsWith('optimistic-') && (
                      <StatusIcon status={messageStatus(msg)} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Gib eine Nachricht ein."
          rows={1}
          aria-label="Nachricht"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          className="chat-send-button"
          disabled={pending || !draft.trim()}
          aria-label="Nachricht senden"
        >
          <Send size={18} />
        </button>
      </form>
      {error && <p className="chat-error">{error}</p>}
    </>
  );
}
