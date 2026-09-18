'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  softDeleteDailyLogPhoto,
  softDeleteDeliveryNote,
  softDeleteSubcontractorEntry,
} from '@/lib/actions/admin';
import { ConfirmDialog } from '@/components/ui/app-dialogs';

type DeleterProfile = {
  first_name: string;
  last_name: string;
} | null;

type PhotoEntry = {
  id: string;
  file_url: string | null;
  deleted_at: string | null;
  deleter: DeleterProfile;
};

type DeliveryItem = {
  id: string;
  description: string;
  quantity: number | null;
  unit: string | null;
};

type DeliveryEntry = {
  id: string;
  supplier_name: string | null;
  delivery_note_number: string | null;
  delivery_date: string | null;
  description: string | null;
  file_url: string | null;
  deleted_at: string | null;
  deleter: DeleterProfile;
  items: DeliveryItem[];
};

type SubcontractorEntryItem = {
  id: string;
  company_name: string;
  work_description: string | null;
  hours: number | null;
  deleted_at: string | null;
  deleter: DeleterProfile;
};

type LogEntry = {
  id: string;
  log_date: string;
  weather: string | null;
  notes: string | null;
  site_name: string;
  photos: PhotoEntry[];
  deliveries: DeliveryEntry[];
  subcontractors: SubcontractorEntryItem[];
};

type DeleteTarget = {
  type: 'photo' | 'delivery' | 'subcontractor';
  id: string;
  label: string;
};

type Props = {
  logs: LogEntry[];
  signedUrls: Record<string, string>;
  canDelete: boolean;
};

function formatDeleterName(deleter: DeleterProfile): string {
  if (!deleter) return 'Unbekannt';
  return `${deleter.first_name} ${deleter.last_name}`.trim() || 'Unbekannt';
}

function formatDeletedAt(deletedAt: string): string {
  const date = new Date(deletedAt);
  if (Number.isNaN(date.getTime())) return deletedAt.slice(0, 10);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DeletedBadge({ deletedAt, deleter }: { deletedAt: string; deleter: DeleterProfile }) {
  return (
    <span className="status-badge danger documentation-entry-deleted-badge">
      Wurde gelöscht am {formatDeletedAt(deletedAt)} von {formatDeleterName(deleter)}
    </span>
  );
}

function DeleteButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="table-action-link table-action-link--danger"
      disabled={disabled}
      onClick={onClick}
    >
      Löschen
    </button>
  );
}

export function DailyLogEntriesList({ logs, signedUrls, canDelete }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  function confirmDelete() {
    if (!deleteTarget) return;
    const formData = new FormData();
    formData.set('id', deleteTarget.id);

    const action =
      deleteTarget.type === 'photo'
        ? softDeleteDailyLogPhoto
        : deleteTarget.type === 'delivery'
          ? softDeleteDeliveryNote
          : softDeleteSubcontractorEntry;

    setError(null);
    startTransition(async () => {
      try {
        await action(formData);
        setDeleteTarget(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      }
    });
  }

  if (!logs.length) {
    return <p className="muted">Keine Tagesdaten vorhanden.</p>;
  }

  return (
    <>
      {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="form-stack">
        {logs.map((log) => (
          <div key={log.id} className="panel" style={{ padding: 16 }}>
            <strong>{log.log_date} · {log.site_name}</strong>
            <p className="muted">Wetter: {log.weather ?? '—'} · Notiz: {log.notes ?? '—'}</p>

            {log.photos.length > 0 && (
              <div className="documentation-entry-group">
                <p className="documentation-entry-group-title">Fotos</p>
                <div className="documentation-photo-grid">
                  {log.photos.map((photo) => {
                    const isDeleted = Boolean(photo.deleted_at);
                    const url = !isDeleted && photo.file_url ? signedUrls[photo.file_url] : null;
                    return (
                      <div
                        key={photo.id}
                        className={['documentation-entry', isDeleted ? 'documentation-entry--deleted' : ''].filter(Boolean).join(' ')}
                      >
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="Baustellenfoto" className="documentation-photo-thumb" />
                          </a>
                        ) : (
                          <div className="documentation-photo-thumb documentation-photo-thumb--placeholder" />
                        )}
                        <div className="documentation-entry-actions">
                          {isDeleted && photo.deleted_at && (
                            <DeletedBadge deletedAt={photo.deleted_at} deleter={photo.deleter} />
                          )}
                          {canDelete && !isDeleted && (
                            <DeleteButton
                              disabled={pending}
                              onClick={() =>
                                setDeleteTarget({ type: 'photo', id: photo.id, label: 'Baustellenfoto' })
                              }
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {log.deliveries.length > 0 && (
              <ul className="documentation-entry-list">
                {log.deliveries.map((delivery) => {
                  const isDeleted = Boolean(delivery.deleted_at);
                  const url = !isDeleted && delivery.file_url ? signedUrls[delivery.file_url] : null;
                  return (
                    <li
                      key={delivery.id}
                      className={['documentation-entry', isDeleted ? 'documentation-entry--deleted' : ''].filter(Boolean).join(' ')}
                    >
                      <div className="documentation-entry-row">
                        <div>
                          Lieferung: {delivery.supplier_name ?? '—'}
                          {delivery.delivery_note_number && <> · Nr. {delivery.delivery_note_number}</>}
                          {delivery.delivery_date && <> · {delivery.delivery_date}</>}
                          {delivery.description && <> · {delivery.description}</>}
                          {url && <> · <a href={url} target="_blank" rel="noreferrer">Beleg</a></>}
                        </div>
                        <div className="documentation-entry-actions">
                          {isDeleted && delivery.deleted_at && (
                            <DeletedBadge deletedAt={delivery.deleted_at} deleter={delivery.deleter} />
                          )}
                          {canDelete && !isDeleted && (
                            <DeleteButton
                              disabled={pending}
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'delivery',
                                  id: delivery.id,
                                  label: `Lieferung ${delivery.supplier_name ?? ''}`.trim(),
                                })
                              }
                            />
                          )}
                        </div>
                      </div>
                      {delivery.items.length > 0 && (
                        <ul className="documentation-entry-sublist">
                          {delivery.items.map((item) => (
                            <li key={item.id}>
                              {item.description}
                              {item.quantity != null && <> · {item.quantity}</>}
                              {item.unit && <> {item.unit}</>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {log.subcontractors.length > 0 && (
              <ul className="documentation-entry-list">
                {log.subcontractors.map((entry) => {
                  const isDeleted = Boolean(entry.deleted_at);
                  return (
                    <li
                      key={entry.id}
                      className={['documentation-entry', isDeleted ? 'documentation-entry--deleted' : ''].filter(Boolean).join(' ')}
                    >
                      <div className="documentation-entry-row">
                        <div>
                          Subunternehmer: {entry.company_name} · {entry.work_description ?? '—'} · {entry.hours ?? 0} h
                        </div>
                        <div className="documentation-entry-actions">
                          {isDeleted && entry.deleted_at && (
                            <DeletedBadge deletedAt={entry.deleted_at} deleter={entry.deleter} />
                          )}
                          {canDelete && !isDeleted && (
                            <DeleteButton
                              disabled={pending}
                              onClick={() =>
                                setDeleteTarget({
                                  type: 'subcontractor',
                                  id: entry.id,
                                  label: `Subunternehmer ${entry.company_name}`,
                                })
                              }
                            />
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Eintrag löschen"
        message={`${deleteTarget?.label ?? 'Eintrag'} wirklich löschen? Der Eintrag bleibt als gelöscht dokumentiert.`}
        confirmLabel="Löschen"
        danger
        pending={pending}
      />
    </>
  );
}
