'use client';

import { updateLeaveStatus } from '@/lib/actions/employee';
import type { LeaveRequestWithProfile } from '@/lib/leave/queries';
import { LeaveRequestsTable } from '@/components/leave/leave-requests-table';
import { ApproveIconAction, RejectIconAction } from '@/components/ui/icon-action-button';

type Props = {
  requests: LeaveRequestWithProfile[];
  currentUserId: string;
};

export function LeaveFreigabeTable({ requests, currentUserId }: Props) {
  return (
    <LeaveRequestsTable
      requests={requests}
      currentUserId={currentUserId}
      canApprove
      showNotes
      employeeName={(req) => {
        const row = req as LeaveRequestWithProfile;
        return `${row.profiles?.first_name ?? ''} ${row.profiles?.last_name ?? ''}`.trim();
      }}
      extraActions={(req) => (
        <>
          <form action={updateLeaveStatus}>
            <input type="hidden" name="id" value={req.id} />
            <input type="hidden" name="status" value="approved" />
            <ApproveIconAction type="submit" />
          </form>
          <form action={updateLeaveStatus}>
            <input type="hidden" name="id" value={req.id} />
            <input type="hidden" name="status" value="rejected" />
            <RejectIconAction type="submit" />
          </form>
        </>
      )}
    />
  );
}
