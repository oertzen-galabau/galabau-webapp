'use client';

import { Newspaper } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';
import { InfoboardPostBanner } from '@/components/infoboard/infoboard-post-banner';
import { InfoboardPostFormDialog } from '@/components/infoboard/infoboard-post-form-dialog';
import {
  InfoboardPostsCreateButton,
  InfoboardPostsList,
} from '@/components/infoboard/infoboard-posts-list';
import { ConfirmDialog } from '@/components/ui/app-dialogs';
import { AppSidePanel } from '@/components/ui/app-side-panel';
import { deleteInfoboardPost } from '@/lib/actions/infoboard-posts';
import { markInfoboardPostsRead } from '@/lib/actions/infoboard-post-reads';
import { isInfoboardPostImportantActive } from '@/lib/infoboard/post-types';
import type { InfoboardPostRow } from '@/lib/infoboard/types';

type Props = {
  posts: InfoboardPostRow[];
  canManagePosts: boolean;
};

export function InfoboardPostsSurfaces({ posts, canManagePosts }: Props) {
  const router = useRouter();
  const [panelOpen, setPanelOpen] = useState(false);
  const [dismissedUnreadKey, setDismissedUnreadKey] = useState<string | null>(null);
  const [highlightUnreadIds, setHighlightUnreadIds] = useState<Set<string>>(() => new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<InfoboardPostRow | null>(null);
  const [deletingPost, setDeletingPost] = useState<InfoboardPostRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const [, startReadTransition] = useTransition();

  const unreadPosts = useMemo(
    () => posts.filter((post) => post.isUnread),
    [posts],
  );

  const activeImportantPosts = useMemo(
    () =>
      posts.filter((post) =>
        isInfoboardPostImportantActive(post.isImportant, post.importantUntil),
      ),
    [posts],
  );

  const bannerPosts = useMemo(() => {
    const seen = new Set<string>();
    const merged: InfoboardPostRow[] = [];
    for (const post of activeImportantPosts) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      merged.push(post);
    }
    for (const post of unreadPosts) {
      if (seen.has(post.id)) continue;
      seen.add(post.id);
      merged.push(post);
    }
    return merged;
  }, [activeImportantPosts, unreadPosts]);

  const unreadIds = useMemo(() => unreadPosts.map((post) => post.id), [unreadPosts]);

  const unreadKey = unreadIds.join('|');

  const hasActiveImportant = activeImportantPosts.length > 0;

  const showBanner =
    bannerPosts.length > 0 && (hasActiveImportant || dismissedUnreadKey !== unreadKey);

  const markUnreadAndOpen = useCallback(
    (highlightIds: string[]) => {
      setHighlightUnreadIds(new Set(highlightIds));
      setPanelOpen(true);
      if (highlightIds.length) {
        startReadTransition(async () => {
          try {
            await markInfoboardPostsRead(highlightIds);
          } catch {
            /* Beim nächsten Laden kann erneut erscheinen */
          }
        });
      }
    },
    [startReadTransition],
  );

  const openPanelFromBanner = useCallback(() => {
    if (!bannerPosts.length) return;
    if (unreadPosts.length) setDismissedUnreadKey(unreadKey);
    setPanelOpen(true);
    markUnreadAndOpen(unreadIds);
  }, [bannerPosts.length, unreadPosts.length, unreadKey, unreadIds, markUnreadAndOpen]);

  const openPanelQuiet = useCallback(() => {
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setHighlightUnreadIds(new Set());
  }, []);

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
    router.refresh();
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

  const emptyMessage = canManagePosts
    ? 'Noch keine Beiträge — lege den ersten an.'
    : 'Noch keine Beiträge veröffentlicht.';

  const showQuietLink = !showBanner && canManagePosts;

  return (
    <>
      {showBanner && (
        <InfoboardPostBanner posts={bannerPosts} onOpen={openPanelFromBanner} />
      )}
      {showQuietLink && (
        <div className="infoboard-posts-quiet-wrap">
          <button type="button" className="secondary-button infoboard-posts-open-button" onClick={openPanelQuiet}>
            <Newspaper size={18} aria-hidden="true" />
            Beiträge anzeigen
          </button>
        </div>
      )}

      <AppSidePanel open={panelOpen} onClose={closePanel} title="Beiträge">
        <InfoboardPostsList
          posts={posts}
          highlightUnreadIds={highlightUnreadIds}
          canManagePosts={canManagePosts}
          onEdit={openEdit}
          onDelete={(post) => {
            setDeleteError(null);
            setDeletingPost(post);
          }}
          emptyMessage={emptyMessage}
          headerAction={
            canManagePosts ? <InfoboardPostsCreateButton onClick={openCreate} /> : undefined
          }
        />
      </AppSidePanel>

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
