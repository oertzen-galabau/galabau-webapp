'use client';

import { Loader2, Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { DailyLogDictationDraft } from '@/lib/ai/daily-log-dictation';
import {
  isHourlyWageRapport,
  type DailyLogReportType,
} from '@/lib/documentation/report-labels';
import { AppDialog } from '@/components/ui/app-dialogs';

type Props = {
  configured?: boolean;
  disabled?: boolean;
  reportType: DailyLogReportType;
  lockedReportType?: boolean;
  dailyReportLabel: string;
  hourlyRapportLabel: string;
  onReportTypeChange: (type: DailyLogReportType) => void;
  onDraft: (draft: DailyLogDictationDraft) => void;
  onError: (message: string) => void;
};

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function checklistForReportType(hourly: boolean): string[] {
  if (hourly) {
    return [
      'Mitarbeiter der eigenen Firma mit Stunden (z. B. „Max acht Stunden, Anna sechs“)',
      'Ausgeführte Leistungen mit Menge und Einheit (z. B. „30 Quadratmeter Pflaster“)',
      'Maschinen oder Material mit Menge oder Betriebsstunden',
      'Subunternehmer: Firma, Tätigkeit, deren Mitarbeiter mit Stunden',
      'Bemerkungen zu Problemen oder Besonderheiten',
    ];
  }
  return [
    'Ausgeführte Leistungen mit Menge und Einheit (z. B. „Hecken geschnitten, 40 Meter“)',
    'Bemerkungen zu Problemen, Absprachen oder Besonderheiten',
  ];
}

function exampleForReportType(hourly: boolean): string {
  if (hourly) {
    return '„Heute Max acht Stunden und Anna sechs. Wir haben 25 Quadratmeter Pflaster verlegt. Radlader vier Stunden. Die Firma Müller Garten hat drei Leute je acht Stunden für die Pflanzarbeiten gehabt. Kunde wünscht Randstein-Anpassung nächste Woche.“';
  }
  return '„Heute 40 Meter Hecke geschnitten und Wege gereinigt. Material lag schwer zugänglich, Absprache mit Bauleitung für Montag.“';
}

export function DictationRecorder({
  configured = true,
  disabled,
  reportType,
  lockedReportType = false,
  dailyReportLabel,
  hourlyRapportLabel,
  onReportTypeChange,
  onDraft,
  onError,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogReportType, setDialogReportType] = useState<DailyLogReportType>(reportType);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isPending, startTransition] = useTransition();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const hourly = isHourlyWageRapport(dialogReportType);
  const typeLocked = lockedReportType || isRecording || isPending;

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function cleanupRecording() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    mediaRecorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function closeDialog() {
    if (isPending) return;
    cleanupRecording();
    setDialogError(null);
    setDialogOpen(false);
  }

  function openDialog() {
    onError('');
    setDialogError(null);
    setDialogReportType(reportType);
    setSeconds(0);
    setDialogOpen(true);
  }

  function selectReportType(type: DailyLogReportType) {
    if (typeLocked) return;
    setDialogReportType(type);
    onReportTypeChange(type);
  }

  async function startRecording() {
    setDialogError(null);
    onReportTypeChange(dialogReportType);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `diktat.${extension}`, { type: blob.type || 'audio/webm' });

        startTransition(async () => {
          try {
            const formData = new FormData();
            formData.append('audio', file);
            formData.append('report_type', dialogReportType);
            const response = await fetch('/api/dictation/transcribe', { method: 'POST', body: formData });
            const payload = (await response.json()) as { draft?: DailyLogDictationDraft; error?: string };
            if (!response.ok) {
              const message = payload.error ?? 'Diktat fehlgeschlagen';
              setDialogError(message);
              onError(message);
              return;
            }
            if (!payload.draft) {
              const message = 'Keine Diktat-Daten erhalten';
              setDialogError(message);
              onError(message);
              return;
            }
            onDraft(payload.draft);
            setDialogOpen(false);
            setDialogError(null);
            setSeconds(0);
          } catch {
            const message = 'Diktat konnte nicht verarbeitet werden';
            setDialogError(message);
            onError(message);
          }
        });
      };

      recorder.start();
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch {
      const message = 'Mikrofonzugriff verweigert oder nicht verfügbar';
      setDialogError(message);
      onError(message);
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  }

  const busy = isRecording || isPending;
  const checklist = checklistForReportType(hourly);

  return (
    <>
      <div className="dictation-recorder">
        <div className="dictation-recorder-copy">
          <strong>Diktat (optional)</strong>
          <p className="muted">
            {configured
              ? 'Mehrsprachig sprechen – der Entwurf wird auf Deutsch vorbereitet.'
              : '⚠️ Diktat ist derzeit nicht verfügbar'}
          </p>
        </div>
        <div className="dictation-recorder-actions">
          <button
            type="button"
            className="secondary-button secondary-button--compact dictation-recorder-button"
            disabled={!configured || disabled || busy}
            onClick={openDialog}
          >
            <Mic size={18} />
            Diktat starten
          </button>
        </div>
      </div>

      <AppDialog
        open={dialogOpen}
        onClose={closeDialog}
        title="Diktat aufnehmen"
        panelClassName="dictation-dialog-panel dialog-panel--fixed"
        footer={
          <div className="dialog-actions dictation-dialog-footer">
            <button type="button" className="text-button" onClick={closeDialog} disabled={isPending}>
              Abbrechen
            </button>
            {!isRecording ? (
              <button
                type="button"
                className="primary-button"
                disabled={!configured || isPending}
                onClick={startRecording}
              >
                {isPending ? (
                  <>
                    <Loader2 size={18} className="spin" aria-hidden />
                    Wird ausgewertet…
                  </>
                ) : (
                  <>
                    <Mic size={18} aria-hidden />
                    Aufnahme starten
                  </>
                )}
              </button>
            ) : (
              <button type="button" className="primary-button" onClick={stopRecording}>
                <Square size={16} aria-hidden />
                Stopp ({seconds}s)
              </button>
            )}
          </div>
        }
      >
        <div className="dictation-dialog-body">
          <section className="dictation-dialog-section" aria-labelledby="dictation-dialog-type-heading">
            <h3 id="dictation-dialog-type-heading" className="input-form-section-title">
              Berichtsart
            </h3>
            <div
              className={`dictation-dialog-type-options${typeLocked ? ' is-locked' : ''}`}
              role="radiogroup"
              aria-labelledby="dictation-dialog-type-heading"
            >
              <button
                type="button"
                role="radio"
                aria-checked={dialogReportType === 'daily_report'}
                className={`dictation-dialog-type-option${dialogReportType === 'daily_report' ? ' active' : ''}`}
                disabled={typeLocked}
                onClick={() => selectReportType('daily_report')}
              >
                <span className="daily-report-type-option-body">
                  <strong>{dailyReportLabel}</strong>
                  <span className="muted">Tätigkeiten und Bemerkung</span>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={dialogReportType === 'hourly_wage_rapport'}
                className={`dictation-dialog-type-option${dialogReportType === 'hourly_wage_rapport' ? ' active' : ''}`}
                disabled={typeLocked}
                onClick={() => selectReportType('hourly_wage_rapport')}
              >
                <span className="daily-report-type-option-body">
                  <strong>{hourlyRapportLabel}</strong>
                  <span className="muted">Stunden, Leistung, Maschine, Subunternehmer</span>
                </span>
              </button>
            </div>
            {lockedReportType && (
              <p className="muted dictation-dialog-type-hint">Berichtsart ist für diesen Eintrag festgelegt.</p>
            )}
          </section>

          <section className="dictation-dialog-section dictation-dialog-callout" aria-label="Hinweise">
            <p className="muted">
              Sie können in beliebiger Sprache sprechen. Die KI trägt die Inhalte auf Deutsch in die passenden Felder
              ein. Das Wetter wird automatisch aus der Baustellenadresse ermittelt — bitte nicht diktieren.
            </p>
          </section>

          <section
            className="dictation-dialog-section dictation-dialog-checklist-block"
            aria-labelledby="dictation-dialog-checklist-heading"
          >
            <h3 id="dictation-dialog-checklist-heading" className="input-form-section-title">
              Bitte nennen Sie
            </h3>
            <ul className="dictation-dialog-checklist">
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section
            className="dictation-dialog-section dictation-dialog-callout dictation-dialog-example-block"
            aria-label="Beispiel"
          >
            <p className="dictation-dialog-example-label">Beispiel</p>
            <p className="muted dictation-dialog-example-text">{exampleForReportType(hourly)}</p>
          </section>

          <div className="dictation-dialog-status" aria-live="polite">
            {isRecording ? (
              <p className="dictation-dialog-recording-hint" role="status">
                Aufnahme läuft… Sprechen Sie strukturiert entlang der Liste oben.
              </p>
            ) : dialogError ? (
              <p className="dialog-error">{dialogError}</p>
            ) : null}
          </div>
        </div>
      </AppDialog>
    </>
  );
}
