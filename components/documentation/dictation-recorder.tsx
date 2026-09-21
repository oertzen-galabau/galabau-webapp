'use client';

import { Loader2, Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { DailyLogDictationDraft } from '@/lib/ai/daily-log-dictation';

type Props = {
  configured?: boolean;
  disabled?: boolean;
  onDraft: (draft: DailyLogDictationDraft) => void;
  onError: (message: string) => void;
};

function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

export function DictationRecorder({ configured = true, disabled, onDraft, onError }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isPending, startTransition] = useTransition();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startRecording() {
    onError('');
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
            const response = await fetch('/api/dictation/transcribe', { method: 'POST', body: formData });
            const payload = (await response.json()) as { draft?: DailyLogDictationDraft; error?: string };
            if (!response.ok) {
              onError(payload.error ?? 'Diktat fehlgeschlagen');
              return;
            }
            if (!payload.draft) {
              onError('Keine Diktat-Daten erhalten');
              return;
            }
            onDraft(payload.draft);
          } catch {
            onError('Diktat konnte nicht verarbeitet werden');
          }
        });
      };

      recorder.start();
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch {
      onError('Mikrofonzugriff verweigert oder nicht verfügbar');
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

  return (
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
        {!isRecording ? (
          <button
            type="button"
            className="secondary-button secondary-button--compact dictation-recorder-button"
            disabled={!configured || disabled || busy}
            onClick={startRecording}
          >
            {isPending ? <Loader2 size={18} className="spin" /> : <Mic size={18} />}
            {isPending ? 'Wird ausgewertet…' : 'Diktat starten'}
          </button>
        ) : (
          <button
            type="button"
            className="primary-button primary-button--compact dictation-recorder-button"
            onClick={stopRecording}
          >
            <Square size={16} />
            Stopp ({seconds}s)
          </button>
        )}
      </div>
    </div>
  );
}
