'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AppDialog } from '@/components/ui/app-dialogs';
import { saveInfoboardPost, updateInfoboardPost } from '@/lib/actions/infoboard-posts';
import {
  INFOBOARD_POST_TYPES,
  INFOBOARD_POST_TYPE_LABELS,
  isInfoboardPostType,
  type InfoboardPostType,
} from '@/lib/infoboard/post-types';
import type { InfoboardPostRow } from '@/lib/infoboard/types';

type Props = {
  open: boolean;
  onClose: () => void;
  post?: InfoboardPostRow | null;
};

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(iso));
}

function toTimeInput(iso: string | null): string {
  if (!iso) return '08:00';
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Berlin',
  })
    .format(new Date(iso))
    .replace('.', ':');
}

function initialPostType(post?: InfoboardPostRow | null): InfoboardPostType {
  if (post?.postType && isInfoboardPostType(post.postType)) return post.postType;
  return 'news';
}

type FormBodyProps = {
  post?: InfoboardPostRow | null;
  onClose: () => void;
};

function InfoboardPostFormBody({ post, onClose }: FormBodyProps) {
  const router = useRouter();
  const isEdit = Boolean(post);
  const [postType, setPostType] = useState<InfoboardPostType>(() => initialPostType(post));
  const [isImportant, setIsImportant] = useState(() => Boolean(post?.isImportant));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    if (post) formData.set('id', post.id);

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateInfoboardPost(formData);
        } else {
          await saveInfoboardPost(formData);
        }
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
      }
    });
  }

  const showDateFields = postType === 'termin';

  return (
    <form className="input-form infoboard-post-form" onSubmit={handleSubmit}>
      <label className="dialog-field">
        Typ
        <select
          name="post_type"
          value={postType}
          onChange={(e) => setPostType(e.target.value as InfoboardPostType)}
          required
        >
          {INFOBOARD_POST_TYPES.map((type) => (
            <option key={type} value={type}>
              {INFOBOARD_POST_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      <label className="dialog-field">
        Titel
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={post?.title ?? ''}
          placeholder="Kurzer Titel"
          autoFocus
        />
      </label>

      <label className="dialog-field">
        Inhalt
        <textarea
          name="content"
          required
          maxLength={5000}
          rows={4}
          defaultValue={post?.content ?? ''}
          placeholder="Details zum Beitrag"
        />
      </label>

      {showDateFields && (
        <div className="infoboard-post-form-datetime">
          <label className="dialog-field">
            Datum
            <input
              name="published_date"
              type="date"
              required
              defaultValue={toDateInput(post?.publishedAt ?? null)}
            />
          </label>
          <label className="dialog-field">
            Uhrzeit
            <input
              name="published_time"
              type="time"
              defaultValue={toTimeInput(post?.publishedAt ?? null)}
            />
          </label>
        </div>
      )}

      {!showDateFields && (
        <>
          <input type="hidden" name="published_date" value="" />
          <input type="hidden" name="published_time" value="" />
        </>
      )}

      <label className="dialog-field infoboard-post-form-important-check">
        <span className="infoboard-post-form-checkbox-row">
          <input
            type="checkbox"
            name="is_important"
            checked={isImportant}
            onChange={(e) => setIsImportant(e.target.checked)}
          />
          Wichtig (oben im Infodashboard anpinnen)
        </span>
      </label>

      {isImportant && (
        <label className="dialog-field">
          Wichtig bis (optional)
          <input
            name="important_until_date"
            type="date"
            defaultValue={toDateInput(post?.importantUntil ?? null)}
          />
          <small className="muted">Leer lassen = bis zur manuellen Entfernung des Hakens</small>
        </label>
      )}

      {error && <p className="dialog-error">{error}</p>}

      <div className="dialog-actions">
        <button type="button" className="text-button" onClick={onClose} disabled={pending}>
          Abbrechen
        </button>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? 'Wird gespeichert…' : isEdit ? 'Speichern' : 'Veröffentlichen'}
        </button>
      </div>
    </form>
  );
}

export function InfoboardPostFormDialog({ open, onClose, post }: Props) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={post ? 'Beitrag bearbeiten' : 'Beitrag erstellen'}
    >
      {open && <InfoboardPostFormBody key={post?.id ?? 'new'} post={post} onClose={onClose} />}
    </AppDialog>
  );
}
