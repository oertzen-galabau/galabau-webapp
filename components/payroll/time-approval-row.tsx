'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveTimeEntry, rejectTimeEntry } from '@/lib/actions/employee';
import {
  regenerateBookingsForEntry,
  saveManualBooking,
  deleteManualBooking,
} from '@/lib/actions/payroll';
import { BookingPreviewList } from '@/components/payroll/booking-preview-list';
import { AppSelect } from '@/components/ui/app-select';
import { ApproveIconAction, RejectIconAction, TableIconActions } from '@/components/ui/icon-action-button';
import { formatMinutes } from '@/lib/utils/time';
import { BLOCK_TYPE_LABELS, blockDurationMinutes, isTimelineMode } from '@/lib/time-tracking/timeline';

const UNIT_OPTIONS = [
  { value: 'hours', label: 'Std.' },
  { value: 'eur', label: '€' },
];
import type { PayrollBooking, PayrollBookingCode, TimeEntry } from '@/lib/types/database';
import { computeBookingPreview } from '@/lib/payroll/booking-rules';
import type { SegmentInput } from '@/lib/payroll/booking-rules';
import { deserializeTenantConfig, type SerializableTenantPayrollConfig } from '@/lib/payroll/tenant-rules';

type ProfileRef = { first_name: string; last_name: string };

type Props = {
  entry: TimeEntry & {
    profiles?: ProfileRef | ProfileRef[] | null;
    segments?: SegmentInput[];
  };
  bookings: PayrollBooking[];
  codeLabels: Record<string, string>;
  bookingCodes: PayrollBookingCode[];
  canEditBookings: boolean;
  payrollFlags?: { lkw_hours?: boolean };
  isBadWeatherDay?: boolean;
  tenantConfig: SerializableTenantPayrollConfig;
};

function asProfile(value: unknown): ProfileRef | null {
  if (!value || Array.isArray(value)) return null;
  const profile = value as ProfileRef;
  return profile.first_name ? profile : null;
}

export function TimeApprovalRow({
  entry,
  bookings,
  codeLabels,
  bookingCodes,
  canEditBookings,
  payrollFlags,
  isBadWeatherDay,
  tenantConfig,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const profile = asProfile(entry.profiles);

  const preview = computeBookingPreview({
    entry,
    segments: entry.segments ?? [],
    payrollFlags,
    isBadWeatherDay,
    tenantConfig: deserializeTenantConfig(tenantConfig),
  });

  const displayBookings = bookings.length > 0 ? bookings : preview.lines;
  const timelineBlocks = (entry.segments ?? []).filter(
    (segment) => segment.start_time && segment.end_time,
  );
  const hasTimeline = isTimelineMode(entry.segments ?? []);

  return (
    <>
      <tr>
        <td>{profile ? `${profile.first_name} ${profile.last_name}` : '—'}</td>
        <td>{entry.work_date}</td>
        <td className="data-table-col--optional">{entry.start_time?.slice(0, 5)}</td>
        <td className="data-table-col--optional">{entry.end_time?.slice(0, 5)}</td>
        <td>{formatMinutes(entry.work_minutes)}</td>
        <td>{entry.is_driver ? 'Ja' : 'Nein'}</td>
        <td className="data-table-col--optional">
          {entry.bad_weather_claimed ? 'Gemeldet' : '—'}
        </td>
        <td>
          <button type="button" className="text-button" onClick={() => setExpanded((v) => !v)}>
            {displayBookings.length} Buchungen {expanded ? '▲' : '▼'}
          </button>
        </td>
        <td className="data-table-actions">
          <TableIconActions>
            <form action={approveTimeEntry} className="time-approve-form">
              <input type="hidden" name="id" value={entry.id} />
              {entry.bad_weather_claimed ? (
                <label className="time-approve-kug input-form-checkbox">
                  <input type="checkbox" name="bad_weather_confirmed" defaultChecked />
                  KUG bestätigen
                </label>
              ) : null}
              <ApproveIconAction type="submit" disabled={pending} />
            </form>
            <form action={rejectTimeEntry} className="time-reject-form">
              <input type="hidden" name="id" value={entry.id} />
              <textarea name="reason" rows={2} placeholder="Ablehnungsgrund (Pflicht)" required />
              <RejectIconAction type="submit" disabled={pending} />
            </form>
          </TableIconActions>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9}>
            {entry.bad_weather_claimed ? (
              <p className="muted" style={{ marginBottom: 8 }}>
                Mitarbeiter meldet Schlechtwetter (KUG). Bitte bei Freigabe bestätigen oder abwählen.
              </p>
            ) : null}

            {hasTimeline && (
              <div className="time-timeline-summary" style={{ marginBottom: 12 }}>
                <strong>Tagesaufteilung</strong>
                <ul className="simple-list">
                  {timelineBlocks.map((block, index) => (
                    <li key={`${block.start_time}-${index}`}>
                      {BLOCK_TYPE_LABELS[block.block_type]} · {block.start_time.slice(0, 5)}–
                      {block.end_time.slice(0, 5)} ({formatMinutes(blockDurationMinutes(block))})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(entry.missing_breakfast_reason || entry.missing_lunch_reason) && (
              <div className="callout callout-warning" style={{ marginBottom: 12 }}>
                {entry.missing_breakfast_reason ? (
                  <p><strong>Frühstück:</strong> {entry.missing_breakfast_reason}</p>
                ) : null}
                {entry.missing_lunch_reason ? (
                  <p><strong>Mittag:</strong> {entry.missing_lunch_reason}</p>
                ) : null}
              </div>
            )}

            {preview.warnings.length > 0 && (
              <div className="callout callout-warning" style={{ marginBottom: 12 }}>
                {preview.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            <BookingPreviewList
              lines={displayBookings}
              codeLabels={codeLabels}
              warnings={preview.warnings}
            />
            {canEditBookings && (
              <div style={{ marginTop: 12 }}>
                <form
                  action={regenerateBookingsForEntry}
                  style={{ display: 'inline', marginRight: 8 }}
                >
                  <input type="hidden" name="time_entry_id" value={entry.id} />
                  <button type="submit" className="text-button" disabled={pending}>
                    Buchungen neu berechnen
                  </button>
                </form>
                <details>
                  <summary>Manuelle Buchung</summary>
                  <form action={saveManualBooking} className="input-form" style={{ marginTop: 8 }}>
                    <input type="hidden" name="time_entry_id" value={entry.id} />
                    <input type="hidden" name="user_id" value={entry.user_id} />
                    <input type="hidden" name="work_date" value={entry.work_date} />
                    <label>
                      Code
                      <AppSelect
                        name="booking_code"
                        required
                        allowEmpty={false}
                        options={bookingCodes.map((c) => ({
                          value: c.code,
                          label: `${c.code} – ${c.label}`,
                        }))}
                      />
                    </label>
                    <label>
                      Menge
                      <input type="number" name="quantity" step="0.01" min={0} required />
                    </label>
                    <label>
                      Einheit
                      <AppSelect
                        name="unit"
                        defaultValue="hours"
                        required
                        allowEmpty={false}
                        options={UNIT_OPTIONS}
                      />
                    </label>
                    <label>
                      Notiz
                      <input type="text" name="notes" />
                    </label>
                    <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
                      Hinzufügen
                    </button>
                  </form>
                </details>
                {bookings.filter((b) => b.source === 'manual').map((b) => (
                  <form key={b.id} action={deleteManualBooking} style={{ marginTop: 4 }}>
                    <input type="hidden" name="id" value={b.id} />
                    <span className="muted">
                      Manuell: {b.booking_code} ({b.quantity} {b.unit})
                    </span>
                    <button type="submit" className="text-button" disabled={pending}>Löschen</button>
                  </form>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
