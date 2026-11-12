'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  feedbackKindLabel,
  feedbackPriorityLabel,
} from '@/lib/feedback/labels';
import type { FeedbackReportListRow } from '@/lib/actions/feedback';

type Props = {
  row: FeedbackReportListRow;
  userLabel: string;
  onOpen: (id: string) => void;
  disabled?: boolean;
};

export function FeedbackKanbanCard({ row, userLabel, onOpen, disabled }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `card-${row.id}`,
    data: { reportId: row.id, status: row.status },
    disabled,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={[
        'feedback-kanban-card',
        isDragging ? 'feedback-kanban-card--dragging' : '',
        `feedback-kanban-card--priority-${row.priority}`,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="feedback-kanban-card-open"
        onClick={() => onOpen(row.id)}
        disabled={disabled}
        {...listeners}
        {...attributes}
      >
        <span className="feedback-kanban-card-title">{row.title}</span>
        {row.attachment_count > 0 ? (
          <span className="feedback-kanban-card-attach muted">
            {row.attachment_count} Bild{row.attachment_count === 1 ? '' : 'er'}
          </span>
        ) : null}
        <div className="feedback-kanban-card-meta muted">
          <span>{feedbackKindLabel(row.kind)}</span>
          <span aria-hidden>·</span>
          <span>{row.tenant_name}</span>
        </div>
        <div className="feedback-kanban-card-meta muted">
          <span>{userLabel}</span>
          <span aria-hidden>·</span>
          <span>
            {new Date(row.created_at).toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <span
          className={[
            'feedback-kanban-chip',
            `feedback-kanban-chip--priority-${row.priority}`,
          ].join(' ')}
        >
          {feedbackPriorityLabel(row.priority)}
        </span>
      </button>
    </article>
  );
}

export function FeedbackKanbanCardOverlay({
  row,
  userLabel,
}: {
  row: FeedbackReportListRow;
  userLabel: string;
}) {
  return (
    <div
      className={[
        'feedback-kanban-card',
        'feedback-kanban-card--overlay',
        `feedback-kanban-card--priority-${row.priority}`,
      ].join(' ')}
    >
      <span className="feedback-kanban-card-title">{row.title}</span>
      <div className="feedback-kanban-card-meta muted">
        <span>{row.tenant_name}</span>
        <span aria-hidden>·</span>
        <span>{userLabel}</span>
      </div>
    </div>
  );
}
