'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { CSSProperties, ReactNode } from 'react';

type EntryDragPayload = { kind: 'entry'; entryId: string };

export function ScheduleEntryDropWrap({
  entryId,
  planDate,
  enabled,
  slotStyle,
  slotClassName,
  children,
}: {
  entryId: string;
  planDate: string;
  enabled: boolean;
  slotStyle?: CSSProperties;
  slotClassName?: string;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `entry-drop-${entryId}`,
    data: { scheduleDay: planDate },
    disabled: !enabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={slotStyle}
      data-schedule-day={planDate}
      className={[
        slotClassName,
        isOver ? 'schedule-entry-drop-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

export function ScheduleDraggableEntryButton({
  entryId,
  className,
  onActivate,
  ariaLabel,
  disabled,
  children,
}: {
  entryId: string;
  className: string;
  onActivate: () => void;
  ariaLabel: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `entry-${entryId}`,
    data: { kind: 'entry', entryId } satisfies EntryDragPayload,
    disabled,
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={`${className}${isDragging ? ' schedule-day-timeline-event--dragging' : ''}`}
      onClick={onActivate}
      aria-label={ariaLabel}
      suppressHydrationWarning
      {...attributes}
      {...listeners}
    >
      {children}
    </button>
  );
}
