'use client';

import { useState, type ReactNode } from 'react';
import { LeaveRequestForm } from '@/components/leave/leave-request-form';
import { AppDialog } from '@/components/ui/app-dialogs';
import { EditIconAction, TableIconActions } from '@/components/ui/icon-action-button';
import { formatLeaveType } from '@/lib/leave/labels';
import { canEditLeaveRequest, LEAVE_STATUS_LABELS } from '@/lib/leave/request-editable';
import type { LeaveRequest } from '@/lib/types/database';
import { businessDaysBetween } from '@/lib/utils/time';

type Props = {
  requests: LeaveRequest[];
  currentUserId: string;
  canApprove: boolean;
  employeeName?: (req: LeaveRequest) => string;
  showNotes?: boolean;
  extraActions?: (req: LeaveRequest) => ReactNode;
};

export function LeaveRequestsTable({
  requests,
  currentUserId,
  canApprove,
  employeeName,
  showNotes = false,
  extraActions,
}: Props) {
  const [editing, setEditing] = useState<LeaveRequest | null>(null);

  if (requests.length === 0) {
    return null;
  }

  return (
    <>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {employeeName && <th>Mitarbeiter</th>}
              <th className="data-table-col--optional">Art</th>
              <th>Zeitraum</th>
              <th className="data-table-col--optional">Tage</th>
              {showNotes && <th>Notiz</th>}
              <th>Status</th>
              <th className="data-table-col--optional" aria-label="Aktionen" />
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => {
              const isOwner = req.user_id === currentUserId;
              const editable = canEditLeaveRequest(req, { isOwner, canApprove });
              return (
                <tr key={req.id}>
                  {employeeName && <td>{employeeName(req)}</td>}
                  <td className="data-table-col--optional">
                    {formatLeaveType(req.leave_type, req.notes)}
                  </td>
                  <td>
                    {req.start_date} – {req.end_date}
                  </td>
                  <td className="data-table-col--optional">
                    {businessDaysBetween(req.start_date, req.end_date)}
                  </td>
                  {showNotes && <td>{req.notes ?? '—'}</td>}
                  <td>
                    <span
                      className={`status-badge ${req.status === 'approved' ? 'active' : req.status === 'rejected' ? 'travel' : ''}`}
                    >
                      {LEAVE_STATUS_LABELS[req.status]}
                    </span>
                  </td>
                  <td className="data-table-actions">
                    {(editable || extraActions) && (
                      <TableIconActions>
                        {editable && (
                          <EditIconAction type="button" onClick={() => setEditing(req)} />
                        )}
                        {extraActions?.(req)}
                      </TableIconActions>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <AppDialog
          open
          onClose={() => setEditing(null)}
          title="Abwesenheit bearbeiten"
          panelClassName="dialog-panel--form"
        >
          <LeaveRequestForm request={editing} onSuccess={() => setEditing(null)} />
        </AppDialog>
      )}
    </>
  );
}
