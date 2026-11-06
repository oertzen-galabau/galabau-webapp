'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  deleteTimeEntryAction,
  resubmitTimeEntryAction,
  updateTimeEntryAction,
} from '@/lib/actions/employee';
import {
  timeEntryStatusBadgeClass,
  timeEntryStatusLabel,
} from '@/lib/time-tracking/approval-labels';
import {
  isOwnSubmittedTimeEntryLocked,
  isTimeEntryDeletable,
  isTimeEntryEditable,
  minEditableWorkDate,
} from '@/lib/time-tracking/entry-editable';
import { ConfirmDialog } from '@/components/ui/app-dialogs';
import {
  CancelEditIconAction,
  DeleteIconAction,
  EditIconAction,
  TableIconActions,
} from '@/components/ui/icon-action-button';
import { TimeEntrySaveForm } from '@/components/time-tracking/time-entry-save-form';
import { BookingPreviewList } from '@/components/payroll/booking-preview-list';
import { computeBookingPreview } from '@/lib/payroll/booking-rules';
import { driverTripLabel } from '@/lib/time-tracking/driver-trip';
import {
  deserializeTenantConfig,
  getBadWeatherSeasonFromConfig,
  type BadWeatherConfig,
  type SerializableTenantPayrollConfig,
} from '@/lib/payroll/tenant-rules';
import { formatMinutes } from '@/lib/utils/time';
import type { PayrollBooking, TimeBlockType, TimeEntry } from '@/lib/types/database';
import type { TimelineBlockInput } from '@/lib/time-tracking/timeline';

type Site = { id: string; name: string };

type EntryWithSite = TimeEntry & { sites?: { name: string } | null };

type Props = {
  entry: EntryWithSite;
  sites: Site[];
  today: string;
  segments?: {
    site_id: string | null;
    travel_minutes: number;
    block_type?: string;
    start_time?: string | null;
    end_time?: string | null;
  }[];
  bookings?: PayrollBooking[];
  codeLabels?: Record<string, string>;
  tenantConfig: SerializableTenantPayrollConfig;
};

export function TimeEntryOverviewRow({
  entry,
  sites,
  today,
  segments = [],
  bookings = [],
  codeLabels = {},
  tenantConfig,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deserializedConfig = deserializeTenantConfig(tenantConfig);
  const badWeatherCfg = deserializedConfig.rules.get('bad_weather')?.config as BadWeatherConfig | undefined;
  const { season_start: badWeatherSeasonStart, season_end: badWeatherSeasonEnd } =
    getBadWeatherSeasonFromConfig(badWeatherCfg);

  const initialBlocks = useMemo(
    () =>
      segments
        .filter((segment) => segment.start_time && segment.end_time)
        .map((segment) => ({
          block_type: (segment.block_type ?? 'site_work') as TimeBlockType,
          start_time: segment.start_time!.slice(0, 5),
          end_time: segment.end_time!.slice(0, 5),
          site_id: segment.site_id,
          travel_minutes: segment.travel_minutes,
        })),
    [segments],
  );

  const bookingSegments: TimelineBlockInput[] = initialBlocks;

  const preview = computeBookingPreview({
    entry,
    segments: bookingSegments,
    tenantConfig: deserializedConfig,
  });
  const displayBookings = bookings.length > 0 ? bookings : preview.lines;

  const editable = isTimeEntryEditable(entry);
  const deletable = isTimeEntryDeletable(entry, today);
  const isRejected = entry.approval_status === 'rejected';
  const isSubmittedLocked = isOwnSubmittedTimeEntryLocked(entry);
  const badgeClass = timeEntryStatusBadgeClass(entry.approval_status, !!entry.end_time);
  const showActions = editable || deletable;

  async function confirmDelete() {
    setDeletePending(true);
    setDeleteError(null);
    try {
      const formData = new FormData();
      formData.set('id', entry.id);
      const result = await deleteTimeEntryAction(null, formData);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setDeleteOpen(false);
      router.refresh();
    } finally {
      setDeletePending(false);
    }
  }

  return (
    <>
      <tr className="data-table-row">
        <td>{entry.work_date}</td>
        <td>{entry.sites?.name ?? '—'}</td>
        <td className="data-table-col--optional">{entry.start_time?.slice(0, 5)}</td>
        <td className="data-table-col--optional">{entry.end_time?.slice(0, 5) ?? '—'}</td>
        <td>{entry.end_time ? `${formatMinutes(entry.work_minutes)} Std.` : '—'}</td>
        <td>{driverTripLabel(entry)}</td>
        <td>
          <span className={`status-badge ${badgeClass}`}>
            {timeEntryStatusLabel(entry.approval_status, !!entry.end_time)}
          </span>
          {isRejected && !editing ? (
            <Link href="/app/zeiten#korrektur" className="text-button" style={{ marginLeft: 8 }}>
              Korrigieren
            </Link>
          ) : null}
          {isSubmittedLocked && entry.approval_status === 'pending' ? (
            <span className="muted" style={{ display: 'block', marginTop: 4, fontSize: '0.85rem' }}>
              Eingereicht — Änderung nicht möglich
            </span>
          ) : null}
        </td>
        {showActions && (
          <td className="data-table-actions">
            <TableIconActions>
              {editable && (
                editing ? (
                  <CancelEditIconAction
                    disabled={deletePending}
                    onClick={() => setEditing(false)}
                  />
                ) : (
                  <EditIconAction
                    disabled={deletePending}
                    onClick={() => setEditing(true)}
                  />
                )
              )}
              {deletable && (
                <DeleteIconAction disabled={deletePending} onClick={() => setDeleteOpen(true)} />
              )}
            </TableIconActions>
          </td>
        )}
        {!showActions && <td className="data-table-col--optional data-table-actions" />}
      </tr>

      {entry.end_time && displayBookings.length > 0 && (
        <tr>
          <td colSpan={8}>
            <button type="button" className="text-button" onClick={() => setShowBookings((v) => !v)}>
              Buchungen {showBookings ? '▲' : '▼'}
            </button>
            {showBookings && (
              <BookingPreviewList
                lines={displayBookings}
                codeLabels={codeLabels}
                warnings={preview.warnings}
              />
            )}
          </td>
        </tr>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
        title="Zeiteintrag löschen"
        message={`Zeiteintrag vom ${entry.work_date} wirklich löschen?${deleteError ? `\n\n${deleteError}` : ''}`}
        confirmLabel="Löschen"
        danger
        pending={deletePending}
      />

      {editing && editable && (
        <tr className="time-entry-edit-row">
          <td colSpan={8}>
            {isRejected && entry.rejection_reason ? (
              <div className="callout callout-danger" style={{ marginBottom: 16 }}>
                <strong>Ablehnungsgrund</strong>
                <p>{entry.rejection_reason}</p>
              </div>
            ) : null}
            <TimeEntrySaveForm
              action={isRejected ? resubmitTimeEntryAction : updateTimeEntryAction}
              hiddenFields={<input type="hidden" name="id" value={entry.id} />}
              sites={sites}
              entry={entry}
              initialBlocks={initialBlocks}
              submitLabel={isRejected ? 'Erneut einreichen' : 'Speichern'}
              minDate={minEditableWorkDate(today)}
              maxDate={today}
              compact
              badWeatherSeasonStart={badWeatherSeasonStart}
              badWeatherSeasonEnd={badWeatherSeasonEnd}
              onSuccess={() => setEditing(false)}
            />
          </td>
        </tr>
      )}
    </>
  );
}
