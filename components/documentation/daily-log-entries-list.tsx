'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  softDeleteDailyLogPhoto,
  softDeleteDeliveryNote,
  softDeleteSubcontractorEntry,
} from '@/lib/actions/admin';
import { ConfirmDialog } from '@/components/ui/app-dialogs';
import { formatSignatureAuditLine } from '@/lib/documentation/signature-location';
import { DailyLogReportTypeBadge } from '@/components/documentation/daily-log-report-type-badge';
import {
  displayTitleForLog,
  isHourlyWageRapport,
  type DailyLogReportType,
} from '@/lib/documentation/report-labels';

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

type WorkerSummary = {
  worker_name: string;
  job_title: string | null;
  hours: number;
};

type WorkItemSummary = {
  description: string;
  quantity: number | null;
  unit: string | null;
};

type ResourceSummary = {
  name: string;
  quantity: number | null;
  unit: string | null;
  hours: number;
};

type SignatureSummary = {
  role: 'contractor' | 'client';
  signer_name: string | null;
  file_url: string;
  signed_at: string | null;
  signed_latitude: number | null;
  signed_longitude: number | null;
  signed_location_label: string | null;
};

type LogEntry = {
  id: string;
  log_date: string;
  report_type: DailyLogReportType;
  custom_title: string | null;
  weather: string | null;
  notes: string | null;
  site_name: string;
  client_name: string | null;
  workers: WorkerSummary[];
  workItems: WorkItemSummary[];
  resources: ResourceSummary[];
  photos: PhotoEntry[];
  deliveries: DeliveryEntry[];
  subcontractors: SubcontractorEntryItem[];
  signatures: SignatureSummary[];
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
  canEdit?: boolean;
};

function formatQuantity(quantity: number | null, unit: string | null) {
  if (quantity == null && !unit) return '';
  return `${quantity ?? '—'}${unit ? ` ${unit}` : ''}`;
}

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

export function DailyLogEntriesList({ logs, signedUrls, canDelete, canEdit = false }: Props) {
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
        {logs.map((log) => {
          const hourly = isHourlyWageRapport(log.report_type);
          const displayTitle = displayTitleForLog(log.report_type, log.custom_title);
          return (
          <div key={log.id} className="panel" style={{ padding: 16 }}>
            <div className="documentation-entry-row">
              <div>
                <div className="documentation-entry-title-row">
                  <strong>{log.log_date} · {log.site_name}</strong>
                  <DailyLogReportTypeBadge reportType={log.report_type} customTitle={log.custom_title} />
                </div>
                {log.custom_title?.trim() && (
                  <p className="muted" style={{ marginTop: 4 }}>{displayTitle}</p>
                )}
                <p className="muted">
                  Auftraggeber: {log.client_name ?? '—'} · Wetter: {log.weather ?? '—'}
                  {log.notes ? ` · Notiz: ${log.notes}` : ''}
                </p>
              </div>
              {canEdit && (
                <Link href={`/app/dokumentation?edit=${log.id}`} className="table-action-link">
                  Bearbeiten
                </Link>
              )}
            </div>

            {hourly && log.workers.length > 0 && (
              <div className="documentation-entry-group">
                <p className="documentation-entry-group-title">Mitarbeiter</p>
                <ul className="documentation-entry-list">
                  {log.workers.map((worker, index) => (
                    <li key={`${log.id}-worker-${index}`}>
                      {worker.worker_name}
                      {worker.job_title ? ` (${worker.job_title})` : ''} — {worker.hours} Std.
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {log.workItems.length > 0 && (
              <div className="documentation-entry-group">
                <p className="documentation-entry-group-title">Leistungen</p>
                <ul className="documentation-entry-list">
                  {log.workItems.map((item, index) => (
                    <li key={`${log.id}-work-${index}`}>
                      {item.description}
                      {formatQuantity(item.quantity, item.unit) && ` · ${formatQuantity(item.quantity, item.unit)}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hourly && log.resources.length > 0 && (
              <div className="documentation-entry-group">
                <p className="documentation-entry-group-title">Maschine / Material</p>
                <ul className="documentation-entry-list">
                  {log.resources.map((item, index) => (
                    <li key={`${log.id}-resource-${index}`}>
                      {item.name}
                      {formatQuantity(item.quantity, item.unit) && ` · ${formatQuantity(item.quantity, item.unit)}`}
                      {item.hours > 0 ? ` · ${item.hours} Std.` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hourly && log.signatures.length > 0 && (
              <div className="documentation-entry-group">
                <p className="documentation-entry-group-title">Unterschriften</p>
                <div className="documentation-photo-grid">
                  {log.signatures.map((signature) => {
                    const url = signedUrls[signature.file_url];
                    const label = signature.role === 'contractor' ? 'Auftragnehmer' : 'Auftraggeber';
                    return (
                      <div key={`${log.id}-${signature.role}`} className="documentation-entry">
                        <p className="muted">{label}: {signature.signer_name ?? '—'}</p>
                        {signature.signed_at &&
                          signature.signed_latitude != null &&
                          signature.signed_longitude != null && (
                            <p className="report-signature-meta muted">
                              {formatSignatureAuditLine(
                                signature.signed_at,
                                signature.signed_location_label,
                                signature.signed_latitude,
                                signature.signed_longitude,
                              )}
                            </p>
                          )}
                        {url ? (
                          <img src={url} alt={`Unterschrift ${label}`} className="documentation-photo-thumb" />
                        ) : (
                          <div className="documentation-photo-thumb documentation-photo-thumb--placeholder" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
        );
        })}
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
