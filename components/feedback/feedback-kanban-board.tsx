'use client';

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useMemo, useState, type ReactNode } from 'react';
import type { FeedbackReportListRow } from '@/lib/actions/feedback';
import { feedbackStatusLabel } from '@/lib/feedback/labels';
import { sortFeedbackKanbanRows } from '@/lib/feedback/kanban-sort';
import {
  FeedbackKanbanCard,
  FeedbackKanbanCardOverlay,
} from '@/components/feedback/feedback-kanban-card';
import type { FeedbackReportStatus } from '@/lib/types/database';

const COLUMNS: FeedbackReportStatus[] = ['open', 'in_progress', 'done'];

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length > 0) return hits;
  return rectIntersection(args);
};

function displayUser(row: FeedbackReportListRow) {
  const name = `${row.user_first_name} ${row.user_last_name}`.trim();
  return name || row.user_email || '—';
}

function resolveTargetStatus(
  overId: string | undefined,
  rows: FeedbackReportListRow[],
): FeedbackReportStatus | null {
  if (!overId) return null;
  if (overId.startsWith('column-')) {
    const raw = overId.slice('column-'.length);
    if (raw === 'open' || raw === 'in_progress' || raw === 'done') return raw;
    return null;
  }
  if (overId.startsWith('card-')) {
    const id = overId.slice('card-'.length);
    const row = rows.find((r) => r.id === id);
    return row?.status ?? null;
  }
  return null;
}

function FeedbackKanbanColumn({
  status,
  title,
  count,
  children,
}: {
  status: FeedbackReportStatus;
  title: string;
  count: number;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { status },
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        'feedback-kanban-column',
        `feedback-kanban-column--${status}`,
        isOver ? 'feedback-kanban-column--over' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="feedback-kanban-column-head">
        <strong>{title}</strong>
        <span className="feedback-kanban-column-count">{count}</span>
      </div>
      <div className="feedback-kanban-column-body">{children}</div>
    </div>
  );
}

type Props = {
  rows: FeedbackReportListRow[];
  onOpenDetail: (id: string) => void;
  onMoveCard: (id: string, toStatus: FeedbackReportStatus) => Promise<void>;
  movePending?: boolean;
};

export function FeedbackKanbanBoard({ rows, onOpenDetail, onMoveCard, movePending }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const byColumn = useMemo(() => {
    const map: Record<FeedbackReportStatus, FeedbackReportListRow[]> = {
      open: [],
      in_progress: [],
      done: [],
    };
    for (const row of rows) {
      map[row.status].push(row);
    }
    for (const status of COLUMNS) {
      map[status].sort(sortFeedbackKanbanRows);
    }
    return map;
  }, [rows]);

  const activeRow = useMemo(() => {
    if (!activeId) return null;
    const id = activeId.startsWith('card-') ? activeId.slice('card-'.length) : activeId;
    return rows.find((r) => r.id === id) ?? null;
  }, [activeId, rows]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const activeIdStr = String(event.active.id);
    if (!activeIdStr.startsWith('card-')) return;
    const reportId = activeIdStr.slice('card-'.length);
    const row = rows.find((r) => r.id === reportId);
    if (!row) return;

    const targetStatus = resolveTargetStatus(
      event.over ? String(event.over.id) : undefined,
      rows,
    );
    if (!targetStatus || targetStatus === row.status) return;

    void onMoveCard(reportId, targetStatus);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="feedback-kanban-board-wrap">
        <div className="feedback-kanban-board">
          {COLUMNS.map((status) => (
            <FeedbackKanbanColumn
              key={status}
              status={status}
              title={feedbackStatusLabel(status)}
              count={byColumn[status].length}
            >
              {byColumn[status].length === 0 ? (
                <p className="muted feedback-kanban-empty">Keine Einträge</p>
              ) : (
                byColumn[status].map((row) => (
                  <FeedbackKanbanCard
                    key={row.id}
                    row={row}
                    userLabel={displayUser(row)}
                    onOpen={onOpenDetail}
                    disabled={movePending}
                  />
                ))
              )}
            </FeedbackKanbanColumn>
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeRow ? (
          <FeedbackKanbanCardOverlay row={activeRow} userLabel={displayUser(activeRow)} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
