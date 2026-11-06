'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FeedbackDialog } from '@/components/feedback/feedback-dialog';
import { FEEDBACK_BOARD_DONE_RECENT_DAYS } from '@/lib/feedback/board';
import {
  feedbackKindLabel,
  feedbackStatusLabel,
} from '@/lib/feedback/labels';
import type { FeedbackBoardData } from '@/lib/feedback/board';

type Props = {
  initialData: FeedbackBoardData;
  highlightId?: string | null;
  thanks?: boolean;
};

export function FeedbackBoard({ initialData, highlightId, thanks = false }: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const closeDialog = () => setDialogOpen(false);
  const [showThanks, setShowThanks] = useState(thanks);

  useEffect(() => {
    setShowThanks(thanks);
  }, [thanks]);

  useEffect(() => {
    if (!highlightId || typeof document === 'undefined') return;
    const mineEl = document.getElementById(`fb-row-mine-${highlightId}`);
    const pubEl = document.getElementById(`fb-row-pub-${highlightId}`);
    const el = mineEl ?? pubEl;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightId, initialData]);

  useEffect(() => {
    if (!thanks) return;
    const t = window.setTimeout(() => {
      router.replace('/app/feedback', { scroll: false });
      setShowThanks(false);
    }, 5000);
    return () => window.clearTimeout(t);
  }, [thanks, router]);

  return (
    <>
      <div className="feedback-board-page">
        <header className="feedback-board-head">
          <div className="feedback-board-head-text">
            <h1 className="feedback-board-title">Offene Tasks</h1>
            <p className="muted feedback-board-lead">
              Hier siehst du den Bearbeitungsstand plattformweit (anonym) sowie deine eigenen Meldungen.
              Zuletzt erledigte Tasks erscheinen nur etwa {FEEDBACK_BOARD_DONE_RECENT_DAYS} Tage.
            </p>
          </div>
          <button type="button" className="primary-button" onClick={() => setDialogOpen(true)}>
            Neue Meldung
          </button>
        </header>

        {showThanks ? (
          <p className="feedback-board-thanks" role="status">
            Meldung übermittelt – danke für dein Feedback.
          </p>
        ) : null}

        <section className="panel feedback-board-section">
          <h2 className="feedback-board-section-title">Meine Meldungen</h2>
          {initialData.mine.length === 0 ? (
            <p className="muted">Noch keine Meldungen von dir.</p>
          ) : (
            <ul className="feedback-board-list">
              {initialData.mine.map((row) => (
                <li
                  key={`mine-${row.id}`}
                  id={`fb-row-mine-${row.id}`}
                  className={[
                    'feedback-board-row',
                    highlightId === row.id ? 'feedback-board-row--highlight' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="feedback-board-row-main">
                    <span className="feedback-board-row-title">{row.title}</span>
                    <span className="feedback-board-meta">
                      {new Date(row.created_at).toLocaleString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="feedback-board-row-badges">
                    <span className="feedback-board-chip feedback-board-chip--kind">
                      {feedbackKindLabel(row.kind)}
                    </span>
                    <span className={`feedback-board-chip feedback-board-status--${row.status}`}>
                      {feedbackStatusLabel(row.status)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel feedback-board-section">
          <h2 className="feedback-board-section-title">Woran gearbeitet wird</h2>
          <p className="muted feedback-board-section-hint">
            Titel und Status aller Mandanten – ohne Firma oder Personenbezug.
          </p>
          {initialData.public.length === 0 ? (
            <p className="muted">Aktuell keine Einträge in diesem Überblick.</p>
          ) : (
            <ul className="feedback-board-list">
              {initialData.public.map((row) => (
                <li
                  key={`pub-${row.id}`}
                  id={`fb-row-pub-${row.id}`}
                  className={[
                    'feedback-board-row',
                    highlightId === row.id ? 'feedback-board-row--highlight' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="feedback-board-row-main">
                    <span className="feedback-board-row-title">{row.title}</span>
                    {row.is_mine ? (
                      <span className="feedback-board-mine-badge">Von mir</span>
                    ) : null}
                  </div>
                  <div className="feedback-board-row-badges">
                    <span className="feedback-board-chip feedback-board-chip--kind">
                      {feedbackKindLabel(row.kind)}
                    </span>
                    <span className={`feedback-board-chip feedback-board-status--${row.status}`}>
                      {feedbackStatusLabel(row.status)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <FeedbackDialog open={dialogOpen} onClose={closeDialog} />
    </>
  );
}
