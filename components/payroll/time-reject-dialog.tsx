'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { rejectTimeEntry } from '@/lib/actions/employee';
import {
  deleteTimeRejectionTemplate,
  saveTimeRejectionTemplate,
} from '@/lib/actions/time-rejection-templates';
import { AppDialog } from '@/components/ui/app-dialogs';
import { AppSelect } from '@/components/ui/app-select';
import { DeleteIconAction } from '@/components/ui/icon-action-button';
import type { TimeRejectionTemplate } from '@/lib/types/database';

type Props = {
  open: boolean;
  onClose: () => void;
  entryId: string;
  employeeLabel: string;
  workDate: string;
  templates: TimeRejectionTemplate[];
};

export function TimeRejectDialog({
  open,
  onClose,
  entryId,
  employeeLabel,
  workDate,
  templates,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectReason, setRejectReason] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateLabel, setTemplateLabel] = useState('');

  function resetAndClose() {
    setRejectReason('');
    setSelectedTemplateId('');
    setDialogError(null);
    setSaveTemplateOpen(false);
    setTemplateLabel('');
    onClose();
  }

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const template = templates.find((row) => row.id === templateId);
    if (template) setRejectReason(template.body);
  }

  function submitReject() {
    setDialogError(null);
    const reason = rejectReason.trim();
    if (!reason) {
      setDialogError('Bitte einen Ablehnungsgrund angeben.');
      return;
    }
    const formData = new FormData();
    formData.set('id', entryId);
    formData.set('reason', reason);
    startTransition(async () => {
      try {
        await rejectTimeEntry(formData);
        resetAndClose();
        router.refresh();
      } catch (err) {
        setDialogError(err instanceof Error ? err.message : 'Aktion fehlgeschlagen.');
      }
    });
  }

  function submitSaveTemplate() {
    setDialogError(null);
    const body = rejectReason.trim();
    const label = templateLabel.trim();
    if (!body) {
      setDialogError('Bitte zuerst einen Ablehnungsgrund eintragen.');
      return;
    }
    if (!label) {
      setDialogError('Bitte einen Namen für die Vorlage angeben.');
      return;
    }
    const formData = new FormData();
    formData.set('label', label);
    formData.set('body', body);
    formData.set('sort_order', String(templates.length * 10));
    startTransition(async () => {
      try {
        await saveTimeRejectionTemplate(formData);
        setSaveTemplateOpen(false);
        setTemplateLabel('');
        router.refresh();
      } catch (err) {
        setDialogError(err instanceof Error ? err.message : 'Vorlage konnte nicht gespeichert werden.');
      }
    });
  }

  function removeTemplate(templateId: string) {
    setDialogError(null);
    const formData = new FormData();
    formData.set('id', templateId);
    startTransition(async () => {
      try {
        await deleteTimeRejectionTemplate(formData);
        if (selectedTemplateId === templateId) setSelectedTemplateId('');
        router.refresh();
      } catch (err) {
        setDialogError(err instanceof Error ? err.message : 'Vorlage konnte nicht gelöscht werden.');
      }
    });
  }

  const templateOptions = templates.map((row) => ({
    value: row.id,
    label: row.label,
  }));

  return (
    <AppDialog
      open={open}
      onClose={resetAndClose}
      title="Zeit ablehnen"
      subtitle={`${employeeLabel} · ${workDate}`}
      footer={
        <div className="dialog-actions">
          {dialogError ? (
            <p className="dialog-error dialog-error--footer" role="alert">
              {dialogError}
            </p>
          ) : null}
          <button type="button" className="text-button" onClick={resetAndClose} disabled={pending}>
            Abbrechen
          </button>
          <button
            type="button"
            className="primary-button primary-button--danger"
            disabled={pending}
            onClick={submitReject}
          >
            {pending ? 'Bitte warten…' : 'Ablehnen'}
          </button>
        </div>
      }
    >
      {templates.length > 0 ? (
        <div className="dialog-field">
          <span>Vorlage</span>
          <AppSelect
            value={selectedTemplateId}
            onValueChange={applyTemplate}
            options={templateOptions}
            placeholder="Vorlage wählen…"
            allowEmpty
            disabled={pending}
            aria-label="Ablehnungsvorlage wählen"
          />
        </div>
      ) : null}

      <label className="dialog-field">
        Ablehnungsgrund (Pflicht)
        <textarea
          rows={3}
          value={rejectReason}
          onChange={(event) => {
            setRejectReason(event.target.value);
            setSelectedTemplateId('');
          }}
          placeholder="Kurz begründen, warum die Zeit nicht freigegeben wird."
          autoFocus={templates.length === 0}
          disabled={pending}
        />
      </label>

      <div className="time-reject-template-tools">
        {!saveTemplateOpen ? (
          <button
            type="button"
            className="text-button"
            disabled={pending || !rejectReason.trim()}
            onClick={() => {
              setSaveTemplateOpen(true);
              setTemplateLabel('');
              setDialogError(null);
            }}
          >
            Als Vorlage speichern
          </button>
        ) : (
          <div className="time-reject-template-save">
            <label className="dialog-field dialog-field--compact">
              Name der Vorlage
              <input
                type="text"
                maxLength={80}
                value={templateLabel}
                onChange={(event) => setTemplateLabel(event.target.value)}
                placeholder="z. B. Pause fehlt"
                disabled={pending}
              />
            </label>
            <div className="time-reject-template-save-actions">
              <button
                type="button"
                className="text-button"
                disabled={pending}
                onClick={() => {
                  setSaveTemplateOpen(false);
                  setTemplateLabel('');
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="secondary-button secondary-button--compact"
                disabled={pending}
                onClick={submitSaveTemplate}
              >
                Vorlage speichern
              </button>
            </div>
          </div>
        )}

        {templates.length > 0 ? (
          <ul className="time-reject-template-list simple-list" aria-label="Gespeicherte Vorlagen">
            {templates.map((row) => (
              <li key={row.id}>
                <span className="time-reject-template-list-label">{row.label}</span>
                <DeleteIconAction
                  type="button"
                  disabled={pending}
                  onClick={() => removeTemplate(row.id)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </AppDialog>
  );
}
