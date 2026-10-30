'use client';

import type { ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  infoboardPostTypeBadgeClass,
  infoboardPostTypeLabel,
  isInfoboardPostImportantActive,
} from '@/lib/infoboard/post-types';
import type { InfoboardPostRow } from '@/lib/infoboard/types';

export function formatInfoboardPostDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(new Date(iso));
}

type PostItemProps = {
  post: InfoboardPostRow;
  highlightUnread: boolean;
  canManagePosts: boolean;
  onEdit: (post: InfoboardPostRow) => void;
  onDelete: (post: InfoboardPostRow) => void;
};

export function InfoboardPostListItem({
  post,
  highlightUnread,
  canManagePosts,
  onEdit,
  onDelete,
}: PostItemProps) {
  const highlightImportant = isInfoboardPostImportantActive(
    post.isImportant,
    post.importantUntil,
  );

  return (
    <article
      className={`infoboard-post-item${highlightUnread ? ' infoboard-post-item--unread' : ''}${highlightImportant ? ' infoboard-post-item--important' : ''}`}
    >
      <header>
        <div className="infoboard-post-item-title">
          {highlightUnread && (
            <span className="infoboard-post-unread-dot" aria-hidden="true" title="Ungelesen" />
          )}
          <strong>{post.title}</strong>
          {highlightUnread && <span className="infoboard-post-unread-label">Neu</span>}
          {highlightImportant && (
            <span className="infoboard-post-important-label">Wichtig</span>
          )}
          {post.postType && (
            <span className={`status-badge ${infoboardPostTypeBadgeClass(post.postType)}`}>
              {infoboardPostTypeLabel(post.postType)}
            </span>
          )}
        </div>
        <div className="infoboard-post-item-meta">
          <small>{formatInfoboardPostDate(post.publishedAt ?? post.createdAt)}</small>
          {canManagePosts && (
            <span className="infoboard-post-actions">
              <button
                type="button"
                className="infoboard-post-action"
                aria-label="Beitrag bearbeiten"
                onClick={() => onEdit(post)}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                className="infoboard-post-action infoboard-post-action--danger"
                aria-label="Beitrag löschen"
                onClick={() => onDelete(post)}
              >
                <Trash2 size={15} />
              </button>
            </span>
          )}
        </div>
      </header>
      <p>{post.content}</p>
    </article>
  );
}

type ListProps = {
  posts: InfoboardPostRow[];
  highlightUnreadIds: ReadonlySet<string>;
  canManagePosts: boolean;
  onEdit: (post: InfoboardPostRow) => void;
  onDelete: (post: InfoboardPostRow) => void;
  emptyMessage: string;
  headerAction?: ReactNode;
};

export function InfoboardPostsList({
  posts,
  highlightUnreadIds,
  canManagePosts,
  onEdit,
  onDelete,
  emptyMessage,
  headerAction,
}: ListProps) {
  return (
    <div className="infoboard-posts-panel-inner">
      {headerAction}
      <div className="infoboard-post-list">
        {posts.map((post) => (
          <InfoboardPostListItem
            key={post.id}
            post={post}
            highlightUnread={highlightUnreadIds.has(post.id)}
            canManagePosts={canManagePosts}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {!posts.length && <p className="muted">{emptyMessage}</p>}
      </div>
    </div>
  );
}

export function InfoboardPostsCreateButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="text-button infoboard-post-create infoboard-posts-panel-create" onClick={onClick}>
      <Plus size={16} /> Beitrag erstellen
    </button>
  );
}
