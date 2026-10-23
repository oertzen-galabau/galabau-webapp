'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  buildMonthGrid,
  formatMonthLabel,
  isoToViewMonth,
  shiftViewMonth,
  splitPrimaryAndExtraDates,
} from '@/lib/schedule/entry-plan-dates';
import { todayIsoInBerlin, weekDayLabels } from '@/lib/schedule/week';

type Props = {
  initialDays: string[];
  selectedDays?: string[];
  onSelectedDaysChange?: (days: string[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
};

export function ScheduleEntryDayPicker({
  initialDays,
  selectedDays: selectedDaysProp,
  onSelectedDaysChange,
  disabled,
  readOnly,
}: Props) {
  const today = todayIsoInBerlin();
  const seed = initialDays.filter(Boolean);
  const initialView = isoToViewMonth(seed[0] ?? today);

  const [selectedInternal, setSelectedInternal] = useState<Set<string>>(() => new Set(seed));
  const isControlled = selectedDaysProp != null && onSelectedDaysChange != null;
  const selected = isControlled ? new Set(selectedDaysProp) : selectedInternal;

  function setSelected(next: Set<string> | ((prev: Set<string>) => Set<string>)) {
    const resolved = typeof next === 'function' ? next(selected) : next;
    if (isControlled) {
      onSelectedDaysChange!([...resolved].sort());
    } else {
      setSelectedInternal(resolved);
    }
  }
  const [viewYear, setViewYear] = useState(initialView.year);
  const [viewMonth, setViewMonth] = useState(initialView.month);
  const [validationError, setValidationError] = useState<string | null>(null);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const { primary, extras } = splitPrimaryAndExtraDates([...selected]);
  const weekdayLabels = weekDayLabels();

  function toggleDay(iso: string) {
    if (disabled || readOnly) return;
    setValidationError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) {
        if (next.size <= 1) {
          setValidationError('Mindestens ein Tag muss ausgewählt sein.');
          return prev;
        }
        next.delete(iso);
      } else {
        next.add(iso);
      }
      return next;
    });
  }

  function shiftMonth(delta: number) {
    if (disabled) return;
    const next = shiftViewMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  const selectionSummary =
    selected.size === 0
      ? 'Kein Tag ausgewählt'
      : selected.size === 1
        ? '1 Tag ausgewählt'
        : `${selected.size} Tage ausgewählt`;

  return (
    <div className="schedule-entry-day-picker input-form-span-full">
      <p className="input-form-section-title">Tage</p>
      {!readOnly ? (
        <>
          <div className="schedule-entry-day-picker-toolbar">
            <button
              type="button"
              className="secondary-button secondary-button--compact schedule-entry-day-picker-nav"
              onClick={() => shiftMonth(-1)}
              disabled={disabled}
              aria-label="Vorheriger Monat"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="schedule-entry-day-picker-month">{formatMonthLabel(viewYear, viewMonth)}</span>
            <button
              type="button"
              className="secondary-button secondary-button--compact schedule-entry-day-picker-nav"
              onClick={() => shiftMonth(1)}
              disabled={disabled}
              aria-label="Nächster Monat"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="schedule-entry-day-picker-weekdays" aria-hidden="true">
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="schedule-entry-day-picker-grid" role="group" aria-label="Tage auswählen">
            {grid.map((cell) => {
              const isSelected = selected.has(cell.iso);
              const isToday = cell.iso === today;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  className={[
                    'schedule-entry-day-picker__day',
                    !cell.inCurrentMonth ? 'schedule-entry-day-picker__day--outside' : '',
                    isSelected ? 'schedule-entry-day-picker__day--selected' : '',
                    isToday ? 'schedule-entry-day-picker__day--today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => toggleDay(cell.iso)}
                  disabled={disabled}
                  aria-pressed={isSelected}
                  aria-label={cell.iso}
                >
                  {cell.dayOfMonth}
                </button>
              );
            })}
          </div>
          <p className="muted schedule-entry-day-picker-summary">{selectionSummary}</p>
          {validationError ? <p className="form-error">{validationError}</p> : null}
        </>
      ) : (
        <p className="schedule-entry-day-picker-readonly">{seed[0] ?? primary}</p>
      )}

      {(readOnly ? seed[0] ?? primary : primary) ? (
        <input
          type="hidden"
          name="start_date"
          value={readOnly ? (seed[0] ?? primary) : primary}
          required
        />
      ) : null}
      {extras.map((iso) => (
        <input key={iso} type="hidden" name="extra_plan_date[]" value={iso} />
      ))}
    </div>
  );
}
