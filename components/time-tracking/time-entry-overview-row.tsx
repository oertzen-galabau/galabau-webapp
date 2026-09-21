'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteTimeEntry, updateTimeEntry } from '@/lib/actions/employee';
import {
  timeEntryStatusBadgeClass,
  timeEntryStatusLabel,
} from '@/lib/time-tracking/approval-labels';
import {
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
import { TimeEntryFormFields } from '@/components/time-tracking/time-entry-form-fields';
import { BookingPreviewList } from '@/components/payroll/booking-preview-list';
import { computeBookingPreview } from '@/lib/payroll/booking-rules';
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
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deserializedConfig = deserializeTenantConfig(tenantConfig);
  const badWeatherCfg = deserializedConfig.rules.get('bad_weather')?.config as BadWeatherConfig | undefined;
  const { season_start: badWeatherSeasonStart, season_end: badWeatherSeasonEnd } =
    getBadWeatherSeasonFromConfig(badWeatherCfg);

  const bookingSegments: TimelineBlockInput[] = segments.map((segment) => ({
    block_type: (segment.block_type ?? 'site_work') as TimeBlockType,
    start_time: segment.start_time?.slice(0, 5) ?? '',
    end_time: segment.end_time?.slice(0, 5) ?? '',
    site_id: segment.site_id,
    travel_minutes: segment.travel_minutes,
  }));

  const preview = computeBookingPreview({
    entry,
    segments: bookingSegments,
    tenantConfig: deserializedConfig,
  });
  const displayBookings = bookings.length > 0 ? bookings : preview.lines;

  const editable = isTimeEntryEditable(entry);
  const deletable = isTimeEntryDeletable(entry, today);
  const badgeClass = timeEntryStatusBadgeClass(entry.approval_status, !!entry.end_time);
  const showActions = editable || deletable;

  function run(action: () => Promise<void>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        onSuccess?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler');
      }
    });
  }

  function confirmDelete() {
    const formData = new FormData();
    formData.set('id', entry.id);
    run(() => deleteTimeEntry(formData), () => setDeleteOpen(false));
  }

  return (
    <>
      <tr className="data-table-row">
        <td>{entry.work_date}</td>
        <td>{entry.sites?.name ?? '—'}</td>
        <td className="data-table-col--optional">{entry.start_time?.slice(0, 5)}</td>
        <td className="data-table-col--optional">{entry.end_time?.slice(0, 5) ?? '—'}</td>
        <td>{entry.end_time ? formatMinutes(entry.work_minutes) : '—'}</td>
        <td>{entry.is_driver ? 'Ja' : 'Nein'}</td>
        <td>
          <span className={`status-badge ${badgeClass}`}>
            {timeEntryStatusLabel(entry.approval_status, !!entry.end_time)}
          </span>
        </td>
        {showActions && (
          <td className="data-table-actions">
            <TableIconActions>
              {editable && (
                editing ? (
                  <CancelEditIconAction
                    disabled={pending}
                    onClick={() => {
                      setError(null);
                      setEditing(false);
                    }}
                  />
                ) : (
                  <EditIconAction
                    disabled={pending}
                    onClick={() => {
                      setError(null);
                      setEditing(true);
                    }}
                  />
                )
              )}
              {deletable && (
                <DeleteIconAction disabled={pending} onClick={() => setDeleteOpen(true)} />
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
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Zeiteintrag löschen"
        message={`Zeiteintrag vom ${entry.work_date} wirklich löschen?`}
        confirmLabel="Löschen"
        danger
        pending={pending}
      />

      {editing && editable && (
        <tr className="time-entry-edit-row">
          <td colSpan={8}>
            <form
              className="input-form"
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                formData.set('id', entry.id);
                run(() => updateTimeEntry(formData), () => setEditing(false));
              }}
            >
              <TimeEntryFormFields
                sites={sites}
                entry={entry}
                initialBlocks={segments
                  .filter((segment) => segment.start_time && segment.end_time)
                  .map((segment) => ({
                    block_type: (segment.block_type ?? 'site_work') as import('@/lib/types/database').TimeBlockType,
                    start_time: segment.start_time!.slice(0, 5),
                    end_time: segment.end_time!.slice(0, 5),
                    site_id: segment.site_id,
                    travel_minutes: segment.travel_minutes,
                  }))}
                submitLabel="Speichern"
                minDate={minEditableWorkDate(today)}
                maxDate={today}
                compact
                badWeatherSeasonStart={badWeatherSeasonStart}
                badWeatherSeasonEnd={badWeatherSeasonEnd}
              />
            </form>
            {error && <p className="dialog-error">{error}</p>}
          </td>
        </tr>
      )}
    </>
  );
}
