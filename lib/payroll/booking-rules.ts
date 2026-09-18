import type { BookingPreviewLine, PayrollFlags, PayrollSeasonConfig, TimeEntry } from '@/lib/types/database';
import { calculateWorkMinutes } from '@/lib/utils/time';
import {
  DEFAULT_BOOKING_LABELS,
  defaultDayHours,
  isBadWeatherSeason,
  isoWeekday,
} from '@/lib/payroll/constants';
import {
  isRuleConfigured,
  leaveRuleKeyForType,
  type BadWeatherConfig,
  type DriverAllowanceConfig,
  type DriverTravelTimeConfig,
  type LkwHoursConfig,
  type NormalHoursConfig,
  type PassengerTravelAllowanceConfig,
  type PayrollRuleKey,
  type TenantPayrollConfig,
} from '@/lib/payroll/tenant-rules';

export type SegmentInput = {
  site_id: string;
  travel_minutes: number;
};

export type BookingRuleContext = {
  entry: Pick<
    TimeEntry,
    | 'work_date'
    | 'start_time'
    | 'end_time'
    | 'breakfast_start'
    | 'breakfast_end'
    | 'lunch_start'
    | 'lunch_end'
    | 'travel_minutes'
    | 'work_minutes'
    | 'is_driver'
  >;
  segments: SegmentInput[];
  payrollFlags?: PayrollFlags;
  isBadWeatherDay?: boolean;
  seasonConfig?: PayrollSeasonConfig[];
  monthBadWeatherHoursUsed?: number;
  tenantConfig: TenantPayrollConfig;
};

function label(code: string, codeLabels?: Record<string, string>) {
  return codeLabels?.[code] ?? DEFAULT_BOOKING_LABELS[code] ?? code;
}

function roundHours(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

function isRuleEnabled(ctx: BookingRuleContext, key: PayrollRuleKey) {
  const rule = ctx.tenantConfig.rules.get(key);
  return rule?.enabled === true && isRuleConfigured(key, rule.config);
}

function seasonMaxHours(workDate: string, seasonConfig?: PayrollSeasonConfig[]): number | null {
  const month = new Date(workDate).getMonth() + 1;
  if (!isBadWeatherSeason(workDate)) return null;
  const weekday = isoWeekday(workDate);
  if (weekday > 5) return null;
  const row = seasonConfig?.find((c) => c.month === month && c.weekday === weekday);
  return row ? Number(row.max_hours) : null;
}

export function computeNetWorkMinutes(entry: BookingRuleContext['entry']) {
  if (entry.work_minutes > 0 && entry.end_time) {
    return entry.work_minutes;
  }
  return calculateWorkMinutes({
    start_time: entry.start_time,
    end_time: entry.end_time,
    breakfast_start: entry.breakfast_start,
    breakfast_end: entry.breakfast_end,
    lunch_start: entry.lunch_start,
    lunch_end: entry.lunch_end,
    travel_minutes: 0,
  });
}

export function computeBookingPreview(ctx: BookingRuleContext): {
  lines: BookingPreviewLine[];
  warnings: string[];
} {
  const lines: BookingPreviewLine[] = [];
  const warnings: string[] = [];
  const netMinutes = computeNetWorkMinutes(ctx.entry);
  const isDriver = ctx.entry.is_driver === true;
  const lkwHours = ctx.payrollFlags?.lkw_hours === true;
  const codeLabels = ctx.tenantConfig.codeLabels;

  const useLkw = lkwHours && isDriver && isRuleEnabled(ctx, 'lkw_hours');
  const normalRuleKey: PayrollRuleKey = useLkw ? 'lkw_hours' : 'normal_hours';

  if (netMinutes > 0 && isRuleEnabled(ctx, normalRuleKey)) {
    const cfg = ctx.tenantConfig.rules.get(normalRuleKey)!.config as NormalHoursConfig | LkwHoursConfig;
    lines.push({
      booking_code: cfg.code!,
      label: label(cfg.code!, codeLabels),
      quantity: roundHours(netMinutes),
      unit: 'hours',
    });
  }

  if (isDriver && netMinutes > 0 && isRuleEnabled(ctx, 'driver_allowance')) {
    const cfg = ctx.tenantConfig.rules.get('driver_allowance')!.config as DriverAllowanceConfig;
    const threshold = cfg.threshold_minutes ?? 420;
    const taxFree = netMinutes >= threshold;
    const code = taxFree ? cfg.tax_free_code! : cfg.taxable_code!;
    lines.push({
      booking_code: code,
      label: label(code, codeLabels),
      quantity: Number(cfg.amount_eur ?? 6),
      unit: 'eur',
    });
  }

  if (isRuleEnabled(ctx, 'driver_travel_time') || isRuleEnabled(ctx, 'passenger_travel_allowance')) {
    const driverCfg = ctx.tenantConfig.rules.get('driver_travel_time')?.config as DriverTravelTimeConfig;
    const passengerCfg = ctx.tenantConfig.rules.get('passenger_travel_allowance')
      ?.config as PassengerTravelAllowanceConfig;
    const travelThreshold = isDriver
      ? (driverCfg?.threshold_minutes ?? 30)
      : (passengerCfg?.travel_threshold_minutes ?? 30);

    for (const segment of ctx.segments) {
      if (segment.travel_minutes < travelThreshold) continue;

      if (isDriver && isRuleEnabled(ctx, 'driver_travel_time')) {
        const code = driverCfg.code!;
        lines.push({
          booking_code: code,
          label: label(code, codeLabels),
          quantity: roundHours(segment.travel_minutes),
          unit: 'hours',
          notes: `Wegezeit ${segment.travel_minutes} Min.`,
        });
      } else if (!isDriver && isRuleEnabled(ctx, 'passenger_travel_allowance')) {
        const threshold = passengerCfg.threshold_minutes ?? 420;
        const taxFree = netMinutes >= threshold;
        const code = taxFree ? passengerCfg.tax_free_code! : passengerCfg.taxable_code!;
        lines.push({
          booking_code: code,
          label: label(code, codeLabels),
          quantity: Number(passengerCfg.amount_eur ?? 6),
          unit: 'eur',
          notes: `Wegegeld ab ${travelThreshold} Min.`,
        });
      }
    }
  }

  if (
    isRuleEnabled(ctx, 'bad_weather') &&
    ctx.isBadWeatherDay &&
    isBadWeatherSeason(ctx.entry.work_date)
  ) {
    const cfg = ctx.tenantConfig.rules.get('bad_weather')!.config as BadWeatherConfig;
    const minWork = cfg.min_work_minutes ?? 60;
    if (netMinutes >= minWork) {
      const maxDay = seasonMaxHours(ctx.entry.work_date, ctx.seasonConfig);
      const hours = roundHours(netMinutes);
      let quantity = hours;
      if (maxDay != null) {
        const used = ctx.monthBadWeatherHoursUsed ?? 0;
        const remaining = Math.max(0, maxDay * 20 - used);
        if (hours > remaining) {
          warnings.push(
            `Schlechtwetter-Cap: ${hours}h vorgeschlagen, nur noch ${remaining.toFixed(1)}h im Monat verfügbar.`,
          );
          quantity = Math.min(hours, remaining);
        }
      }
      if (quantity > 0) {
        lines.push({
          booking_code: cfg.code!,
          label: label(cfg.code!, codeLabels),
          quantity,
          unit: 'hours',
        });
      }
    }
  }

  for (const rule of ctx.tenantConfig.rules.values()) {
    if (rule.enabled && !isRuleConfigured(rule.rule_key, rule.config)) {
      warnings.push(`Regel „${rule.rule_key}“ ist aktiv, aber nicht vollständig konfiguriert.`);
    }
  }

  return { lines, warnings };
}

export function computeLeaveBookingLines(
  leaveType: string,
  startDate: string,
  endDate: string,
  tenantConfig: TenantPayrollConfig,
  hoursPerDay: (date: string) => number = defaultDayHours,
): BookingPreviewLine[] {
  const ruleKey = leaveRuleKeyForType(leaveType);
  if (!ruleKey) return [];

  const rule = tenantConfig.rules.get(ruleKey);
  if (!rule?.enabled || !isRuleConfigured(ruleKey, rule.config)) return [];

  const code = String(rule.config.code);
  const lines: BookingPreviewLine[] = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);

  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    const weekday = isoWeekday(dateStr);
    if (weekday <= 5) {
      const hours = rule.config.hours_per_day != null
        ? Number(rule.config.hours_per_day)
        : hoursPerDay(dateStr);
      if (hours > 0) {
        lines.push({
          booking_code: code,
          label: label(code, tenantConfig.codeLabels),
          quantity: hours,
          unit: 'hours',
          notes: dateStr,
        });
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return lines;
}
