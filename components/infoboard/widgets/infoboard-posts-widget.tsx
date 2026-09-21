'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { InfoboardPostFormDialog } from '@/components/infoboard/infoboard-post-form-dialog';
import { ConfirmDialog } from '@/components/ui/app-dialogs';
import { deleteInfoboardPost } from '@/lib/actions/infoboard-posts';
import {
  infoboardPostTypeBadgeClass,
  infoboardPostTypeLabel,
} from '@/lib/infoboard/post-types';
import type { InfoboardPostRow } from '@/lib/infoboard/types';

type Props = {
  posts: InfoboardPostRow[];
  canManagePosts: boolean;
};

function formatDate(iso: string | null): string {
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

export function InfoboardPostsWidget({ posts, canManagePosts }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<InfoboardPostRow | null>(null);
  const [deletingPost, setDeletingPost] = useState<InfoboardPostRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();

  function openCreate() {
    setEditingPost(null);
    setFormOpen(true);
  }

  function openEdit(post: InfoboardPostRow) {
    setEditingPost(post);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingPost(null);
  }

  function confirmDelete() {
    if (!deletingPost) return;
    setDeleteError(null);
    const formData = new FormData();
    formData.set('id', deletingPost.id);
    startDeleteTransition(async () => {
      try {
        await deleteInfoboardPost(formData);
        setDeletingPost(null);
        router.refresh();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      }
    });
  }

  return (
    <>
      <section className="panel infoboard-panel-widget">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Infoboard</span>
            <h2>Beiträge</h2>
          </div>
          {canManagePosts && (
            <button
              type="button"
              className="text-button infoboard-post-create"
              onClick={openCreate}
            >
              <Plus size={16} /> Beitrag erstellen
            </button>
          )}
        </div>
        <div className="infoboard-post-list">
          {posts.map((post) => (
            <article className="infoboard-post-item" key={post.id}>
              <header>
                <div className="infoboard-post-item-title">
                  <strong>{post.title}</strong>
                  {post.postType && (
                    <span className={`status-badge ${infoboardPostTypeBadgeClass(post.postType)}`}>
                      {infoboardPostTypeLabel(post.postType)}
                    </span>
                  )}
                </div>
                <div className="infoboard-post-item-meta">
                  <small>{formatDate(post.publishedAt ?? post.createdAt)}</small>
                  {canManagePosts && (
                    <span className="infoboard-post-actions">
                      <button
                        type="button"
                        className="infoboard-post-action"
                        aria-label="Beitrag bearbeiten"
                        onClick={() => openEdit(post)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="infoboard-post-action infoboard-post-action--danger"
                        aria-label="Beitrag löschen"
                        onClick={() => {
                          setDeleteError(null);
                          setDeletingPost(post);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  )}
                </div>
              </header>
              <p>{post.content}</p>
            </article>
          ))}
          {!posts.length && (
            <p className="muted">
              {canManagePosts
                ? 'Noch keine Beiträge — lege den ersten an.'
                : 'Noch keine Beiträge veröffentlicht.'}
            </p>
          )}
        </div>
      </section>

      <InfoboardPostFormDialog open={formOpen} onClose={closeForm} post={editingPost} />

      <ConfirmDialog
        open={Boolean(deletingPost)}
        onClose={() => setDeletingPost(null)}
        title="Beitrag löschen?"
        message={deleteError ?? `„${deletingPost?.title ?? ''}" wird dauerhaft entfernt.`}
        confirmLabel="Löschen"
        onConfirm={confirmDelete}
        pending={deletePending}
        danger
      />
    </>
  );
}
