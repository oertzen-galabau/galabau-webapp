'use client';

import Link from 'next/link';
import { ArrowLeft, Check, CheckCheck, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
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

type DeliveryPatch = Pick<Message, 'delivered_at' | 'read_at'>;

function applyDeliveryPatch(msg: Message, patch?: DeliveryPatch): Message {
  if (!patch) return msg;
  return {
    ...msg,
    delivered_at: patch.delivered_at ?? msg.delivered_at,
    read_at: patch.read_at ?? msg.read_at,
  };
}

function patchMessageDelivery(msg: Message, patch: DeliveryPatch): Message {
  return {
    ...msg,
    delivered_at: patch.delivered_at ?? msg.delivered_at,
    read_at: patch.read_at ?? msg.read_at,
  };
}

export function ChatPanel({ currentUserId, contact, initialMessages }: Props) {
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [deliveryPatches, setDeliveryPatches] = useState<Record<string, DeliveryPatch>>({});
  const [bubbleKeys, setBubbleKeys] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const sortedMessages = useMemo(() => {
    const merged = new Map<string, Message>();
    for (const msg of initialMessages) {
      merged.set(msg.id, applyDeliveryPatch(msg, deliveryPatches[msg.id]));
    }
    for (const msg of localMessages) {
      if (msg.id.startsWith('optimistic-')) {
        const hasServerCopy = [...merged.values()].some(
          (existing) =>
            existing.sender_id === msg.sender_id
            && existing.recipient_id === msg.recipient_id
            && existing.body === msg.body,
        );
        if (hasServerCopy) continue;
      }
      merged.set(msg.id, applyDeliveryPatch(msg, deliveryPatches[msg.id]));
    }
    return [...merged.values()].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [initialMessages, localMessages, deliveryPatches]);

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
          const patch: DeliveryPatch = {
            delivered_at: updated.delivered_at,
            read_at: updated.read_at,
          };
          setDeliveryPatches((prev) => ({ ...prev, [updated.id]: patch }));
          setLocalMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? patchMessageDelivery(m, patch) : m)),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [contact.id, currentUserId]);

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
    setBubbleKeys((prev) => ({ ...prev, [optimisticId]: optimisticId }));
    setLocalMessages((prev) => [...prev, optimisticMessage]);

    startTransition(async () => {
      try {
        const saved = await sendChatMessage(contact.id, text);
        const persisted = saved as Message;
        setBubbleKeys((prev) => ({ ...prev, [persisted.id]: optimisticId }));
        setLocalMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? persisted : m)),
        );
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
          const rowKey = bubbleKeys[msg.id] ?? msg.id;
          const isPending = msg.id.startsWith('optimistic-');
          const showStatus = isOwn && !isPending;

          return (
            <div key={rowKey}>
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
                    {showStatus ? (
                      <StatusIcon status={messageStatus(msg)} />
                    ) : (
                      isOwn && <span className="chat-status-placeholder" aria-hidden />
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
