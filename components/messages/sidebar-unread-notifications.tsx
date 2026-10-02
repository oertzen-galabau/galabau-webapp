'use client';

import Link from 'next/link';
import { displayName } from '@/lib/auth/roles';
import type { UnreadInboxSummary } from '@/lib/messages/unread-inbox';

const SIDEBAR_PREVIEW_LIMIT = 5;

type Props = {
  summaries: UnreadInboxSummary[];
  className?: string;
};

export function SidebarUnreadNotifications({ summaries, className = '' }: Props) {
  if (summaries.length === 0) return null;

  const visible = summaries.slice(0, SIDEBAR_PREVIEW_LIMIT);
  const hiddenCount = summaries.length - visible.length;

  return (
    <div
      className={`sidebar-unread-messages${className ? ` ${className}` : ''}`}
      role="region"
      aria-label="Offene Nachrichten"
    >
      <p className="sidebar-unread-messages-label">Neu</p>
      <ul className="sidebar-unread-messages-list">
        {visible.map((item) => (
          <li key={item.contactId}>
            <Link
              href={`/app/nachrichten/${item.contactId}`}
              className="sidebar-unread-message"
            >
              <span className="sidebar-unread-message-top">
                <strong>
                  {displayName({
                    first_name: item.firstName,
                    last_name: item.lastName,
                    email: '',
                  })}
                </strong>
                {item.unreadCount > 1 && (
                  <span className="sidebar-unread-message-count">{item.unreadCount}</span>
                )}
              </span>
              <span className="sidebar-unread-message-preview">{item.preview}</span>
            </Link>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <Link href="/app/nachrichten" className="sidebar-unread-messages-more">
          {hiddenCount} weitere offene Chat{hiddenCount === 1 ? '' : 's'}
        </Link>
      )}
    </div>
  );
}
