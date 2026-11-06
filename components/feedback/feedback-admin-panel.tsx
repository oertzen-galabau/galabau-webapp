'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  deleteFeedbackReportAdmin,
  getFeedbackReportDetailForSuperadmin,
  updateFeedbackReportAdmin,
  type FeedbackReportDetail,
  type FeedbackReportListRow,
} from '@/lib/actions/feedback';
import {
  feedbackKindLabel,
  feedbackPriorityLabel,
  feedbackStatusLabel,
} from '@/lib/feedback/labels';
import { AppDialog, ConfirmDialog } from '@/components/ui/app-dialogs';
import { AppSelect } from '@/components/ui/app-select';
import { SaveIconAction, TableIconActions } from '@/components/ui/icon-action-button';
import type { FeedbackReportPriority, FeedbackReportStatus } from '@/lib/types/database';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Offen' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'done', label: 'Erledigt' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Niedrig' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Hoch' },
];

const KIND_FILTER_OPTIONS = [
  { value: '', label: 'Alle Typen' },
  { value: 'bug', label: 'Bug' },
  { value: 'feedback', label: 'Feedback' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Alle Status' },
  { value: 'open', label: 'Offen' },
  { value: 'in_progress', label: 'In Arbeit' },
  { value: 'done', label: 'Erledigt' },
];

type Props = {
  initialRows: FeedbackReportListRow[];
};

function displayUser(row: FeedbackReportListRow) {
  const name = `${row.user_first_name} ${row.user_last_name}`.trim();
  return name || row.user_email || '—';
}

export function FeedbackAdminPanel({ initialRows }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [statusFilter, setStatusFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [detail, setDetail] = useState<FeedbackReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openCount = useMemo(() => rows.filter((r) => r.status === 'open').length, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (kindFilter && row.kind !== kindFilter) return false;
      return true;
    });
  }, [rows, statusFilter, kindFilter]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const loaded = await getFeedbackReportDetailForSuperadmin(id);
      setDetail(loaded);
    } finally {
      setDetailLoading(false);
    }
  }

  function patchRow(id: string, patch: Partial<FeedbackReportListRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    if (detail?.id === id) {
      setDetail({ ...detail, ...patch });
    }
  }

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="feedback-admin-head">
        <h2>
          Feedback &amp; Bugs
          {openCount > 0 ? <span className="feedback-admin-open-badge">{openCount} offen</span> : null}
        </h2>
        <div className="feedback-admin-filters">
          <AppSelect
            name="filter_status"
            value={statusFilter}
            onValueChange={setStatusFilter}
            allowEmpty={false}
            options={STATUS_FILTER_OPTIONS}
          />
          <AppSelect
            name="filter_kind"
            value={kindFilter}
            onValueChange={setKindFilter}
            allowEmpty={false}
            options={KIND_FILTER_OPTIONS}
          />
        </div>
      </div>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Mandant</th>
              <th>Nutzer</th>
              <th>Typ</th>
              <th>Titel</th>
              <th>Priorität</th>
              <th>Status</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  Keine Einträge
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className={row.status === 'open' ? 'feedback-row--open' : ''}>
                  <td>{new Date(row.created_at).toLocaleString('de-DE')}</td>
                  <td>{row.tenant_name}</td>
                  <td>{displayUser(row)}</td>
                  <td>{feedbackKindLabel(row.kind)}</td>
                  <td>
                    <button type="button" className="text-button" onClick={() => openDetail(row.id)}>
                      {row.title}
                      {row.attachment_count > 0
                        ? ` (${row.attachment_count} Bild${row.attachment_count === 1 ? '' : 'er'})`
                        : ''}
                    </button>
                  </td>
                  <td>{feedbackPriorityLabel(row.priority)}</td>
                  <td>{feedbackStatusLabel(row.status)}</td>
                  <td className="data-table-actions">
                    <form
                      action={updateFeedbackReportAdmin}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const formData = new FormData(form);
                        startTransition(async () => {
                          await updateFeedbackReportAdmin(formData);
                          patchRow(row.id, {
                            status: formData.get('status') as FeedbackReportStatus,
                            priority: formData.get('priority') as FeedbackReportPriority,
                            internal_note: String(formData.get('internal_note') ?? '') || null,
                          });
                        });
                      }}
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <AppSelect
                        name="status"
                        defaultValue={row.status}
                        allowEmpty={false}
                        options={STATUS_OPTIONS}
                      />
                      <AppSelect
                        name="priority"
                        defaultValue={row.priority}
                        allowEmpty={false}
                        options={PRIORITY_OPTIONS}
                      />
                      <input type="hidden" name="internal_note" value={row.internal_note ?? ''} />
                      <TableIconActions>
                        <SaveIconAction type="submit" disabled={pending} />
                      </TableIconActions>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AppDialog
        open={detailLoading || Boolean(detail)}
        onClose={() => {
          if (detailLoading) return;
          setDetail(null);
        }}
        title={detail?.title ?? 'Details'}
        subtitle={detail ? `${feedbackKindLabel(detail.kind)} · ${detail.tenant_name}` : undefined}
        panelClassName="dialog-panel--feedback-detail"
      >
        {detailLoading && !detail ? <p className="muted">Lade…</p> : null}
        {detail ? (
          <div className="feedback-detail">
            <p className="muted">
              {displayUser(detail)} · {detail.user_email} ·{' '}
              {new Date(detail.created_at).toLocaleString('de-DE')}
            </p>
            {detail.page_url ? (
              <p>
                <a href={detail.page_url} target="_blank" rel="noreferrer">
                  {detail.page_url}
                </a>
              </p>
            ) : null}
            <p className="feedback-detail-description">{detail.description}</p>

            {detail.attachments.length > 0 ? (
              <ul className="feedback-detail-screenshots">
                {detail.attachments.map((a) =>
                  a.signed_url ? (
                    <li key={a.id}>
                      <button type="button" onClick={() => setLightboxUrl(a.signed_url)}>
                        <img src={a.signed_url} alt={a.file_name} />
                      </button>
                    </li>
                  ) : null,
                )}
              </ul>
            ) : null}

            <form
              className="feedback-detail-admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                startTransition(async () => {
                  await updateFeedbackReportAdmin(formData);
                  patchRow(detail.id, {
                    status: formData.get('status') as FeedbackReportStatus,
                    priority: formData.get('priority') as FeedbackReportPriority,
                    internal_note: String(formData.get('internal_note') ?? '').trim() || null,
                  });
                  setDetail({
                    ...detail,
                    status: formData.get('status') as FeedbackReportStatus,
                    priority: formData.get('priority') as FeedbackReportPriority,
                    internal_note: String(formData.get('internal_note') ?? '').trim() || null,
                  });
                });
              }}
            >
              <input type="hidden" name="id" value={detail.id} />
              <div className="feedback-detail-admin-grid">
                <label>
                  Status
                  <AppSelect
                    name="status"
                    defaultValue={detail.status}
                    allowEmpty={false}
                    options={STATUS_OPTIONS}
                  />
                </label>
                <label>
                  Priorität
                  <AppSelect
                    name="priority"
                    defaultValue={detail.priority}
                    allowEmpty={false}
                    options={PRIORITY_OPTIONS}
                  />
                </label>
              </div>
              <label className="dialog-field">
                Interne Notiz
                <textarea
                  name="internal_note"
                  defaultValue={detail.internal_note ?? ''}
                  rows={4}
                  maxLength={8000}
                />
              </label>
              <div className="dialog-actions">
                <button type="button" className="text-button" onClick={() => setDeleteId(detail.id)}>
                  Löschen
                </button>
                <button type="submit" className="primary-button" disabled={pending}>
                  Speichern
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </AppDialog>

      <AppDialog open={Boolean(lightboxUrl)} onClose={() => setLightboxUrl(null)} title="Screenshot">
        {lightboxUrl ? <img src={lightboxUrl} alt="" className="equipment-lightbox-image" /> : null}
      </AppDialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        danger
        title="Meldung löschen?"
        message="Der Eintrag und alle Screenshots werden dauerhaft entfernt."
        pending={pending}
        onConfirm={() => {
          if (!deleteId) return;
          const id = deleteId;
          const formData = new FormData();
          formData.set('id', id);
          startTransition(async () => {
            await deleteFeedbackReportAdmin(formData);
            setRows((prev) => prev.filter((r) => r.id !== id));
            setDeleteId(null);
            setDetail(null);
          });
        }}
      />
    </section>
  );
}
