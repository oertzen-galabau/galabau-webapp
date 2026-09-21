import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_BAD_WEATHER_SEASON_END,
  DEFAULT_BAD_WEATHER_SEASON_START,
} from '@/lib/payroll/constants';

export const PAYROLL_RULE_KEYS = [
  'normal_hours',
  'lkw_hours',
  'driver_allowance',
  'driver_travel_time',
  'passenger_travel_allowance',
  'leave_vacation',
  'leave_sick',
  'leave_school',
  'bad_weather',
] as const;

export type PayrollRuleKey = (typeof PAYROLL_RULE_KEYS)[number];

export type PayrollRuleDef = {
  key: PayrollRuleKey;
  label: string;
  description: string;
  leaveType?: string;
};

export const PAYROLL_RULE_CATALOG: PayrollRuleDef[] = [
  { key: 'normal_hours', label: 'Normalstunden', description: 'Netto-Arbeitszeit als Stunden buchen' },
  { key: 'lkw_hours', label: 'LKW-Std', description: 'Statt Normalstunden, wenn Mitarbeiter LKW-Flag gesetzt und Fahrer' },
  { key: 'driver_allowance', label: 'Fahrer-Zuschlag', description: 'Pauschaler Euro-Betrag wenn Mitarbeiter Fahrer war' },
  { key: 'driver_travel_time', label: 'Wegezeit Fahrer', description: 'Wegezeit in Stunden ab Schwelle, nur für Fahrer' },
  { key: 'passenger_travel_allowance', label: 'Wegegeld Beifahrer', description: 'Pauschaler Euro-Betrag für Beifahrer ab Wegezeit-Schwelle' },
  { key: 'leave_vacation', label: 'Urlaub', description: 'Stunden pro Urlaubstag bei Genehmigung', leaveType: 'urlaub' },
  { key: 'leave_sick', label: 'Krank', description: 'Stunden pro Krankheitstag bei Genehmigung', leaveType: 'krankheit' },
  { key: 'leave_school', label: 'Schule', description: 'Stunden pro Schultag bei Genehmigung', leaveType: 'schule' },
  { key: 'bad_weather', label: 'Schlechtwetter (KUG)', description: 'Konfigurierbare Saison; wenn Tag markiert und Mindest-Arbeitszeit' },
];

export type NormalHoursConfig = { code?: string };
export type LkwHoursConfig = { code?: string };
export type DriverAllowanceConfig = {
  tax_free_code?: string;
  taxable_code?: string;
  threshold_minutes?: number;
  amount_eur?: number;
};
export type DriverTravelTimeConfig = { code?: string; threshold_minutes?: number };
export type PassengerTravelAllowanceConfig = {
  tax_free_code?: string;
  taxable_code?: string;
  threshold_minutes?: number;
  amount_eur?: number;
  travel_threshold_minutes?: number;
};
export type LeaveRuleConfig = { code?: string; hours_per_day?: number };
export type BadWeatherConfig = {
  code?: string;
  min_work_minutes?: number;
  season_start?: string;
  season_end?: string;
};

export function getBadWeatherSeasonFromConfig(config?: BadWeatherConfig): {
  season_start: string;
  season_end: string;
} {
  return {
    season_start: config?.season_start ?? DEFAULT_BAD_WEATHER_SEASON_START,
    season_end: config?.season_end ?? DEFAULT_BAD_WEATHER_SEASON_END,
  };
}

export type PayrollTenantRule = {
  id: string;
  tenant_id: string;
  rule_key: PayrollRuleKey;
  enabled: boolean;
  config: Record<string, unknown>;
};

export type TenantPayrollConfig = {
  rules: Map<PayrollRuleKey, PayrollTenantRule>;
  codeLabels: Record<string, string>;
  activeCodes: string[];
};

export type SerializableTenantPayrollConfig = {
  rules: PayrollTenantRule[];
  codeLabels: Record<string, string>;
  activeCodes: string[];
};

export function serializeTenantConfig(config: TenantPayrollConfig): SerializableTenantPayrollConfig {
  return {
    rules: [...config.rules.values()],
    codeLabels: config.codeLabels,
    activeCodes: config.activeCodes,
  };
}

export function deserializeTenantConfig(data: SerializableTenantPayrollConfig): TenantPayrollConfig {
  const rules = new Map<PayrollRuleKey, PayrollTenantRule>();
  for (const rule of data.rules) {
    rules.set(rule.rule_key, {
      ...rule,
      config: mergeRuleConfig(rule.rule_key, rule.config),
    });
  }
  for (const key of PAYROLL_RULE_KEYS) {
    if (!rules.has(key)) {
      rules.set(key, {
        id: '',
        tenant_id: '',
        rule_key: key,
        enabled: true,
        config: DEFAULT_RULE_CONFIGS[key],
      });
    }
  }
  return { rules, codeLabels: data.codeLabels, activeCodes: data.activeCodes };
}

export const DEFAULT_RULE_CONFIGS: Record<PayrollRuleKey, Record<string, unknown>> = {
  normal_hours: { code: '1000' },
  lkw_hours: { code: '1001' },
  driver_allowance: { tax_free_code: '1004', taxable_code: '1005', threshold_minutes: 420, amount_eur: 6 },
  driver_travel_time: { code: '2013', threshold_minutes: 30 },
  passenger_travel_allowance: {
    tax_free_code: '1006',
    taxable_code: '1007',
    threshold_minutes: 420,
    amount_eur: 6,
    travel_threshold_minutes: 30,
  },
  leave_vacation: { code: '8057' },
  leave_sick: { code: '1650' },
  leave_school: { code: '1002' },
  bad_weather: {
    code: '8110',
    min_work_minutes: 60,
    season_start: DEFAULT_BAD_WEATHER_SEASON_START,
    season_end: DEFAULT_BAD_WEATHER_SEASON_END,
  },
};

export const DEFAULT_BOOKING_CODE_SEED = [
  { code: '1000', label: 'Normalstunden', unit: 'hours' as const, is_tax_free: false, sort_order: 1 },
  { code: '1001', label: 'LKW-Std', unit: 'hours' as const, is_tax_free: false, sort_order: 2 },
  { code: '1002', label: 'Schule', unit: 'hours' as const, is_tax_free: false, sort_order: 3 },
  { code: '1004', label: 'Fahrer-Zuschlag steuerfrei', unit: 'eur' as const, is_tax_free: true, sort_order: 4 },
  { code: '1005', label: 'Fahrer-Zuschlag steuerpflichtig', unit: 'eur' as const, is_tax_free: false, sort_order: 5 },
  { code: '1006', label: 'Wegegeld steuerfrei', unit: 'eur' as const, is_tax_free: true, sort_order: 6 },
  { code: '1007', label: 'Wegegeld steuerpflichtig', unit: 'eur' as const, is_tax_free: false, sort_order: 7 },
  { code: '1650', label: 'Krank', unit: 'hours' as const, is_tax_free: false, sort_order: 8 },
  { code: '2013', label: 'Wegezeit Fahrer', unit: 'hours' as const, is_tax_free: false, sort_order: 9 },
  { code: '8057', label: 'Urlaub', unit: 'hours' as const, is_tax_free: false, sort_order: 10 },
  { code: '8110', label: 'Saison KUG Schlechtwetter', unit: 'hours' as const, is_tax_free: false, sort_order: 11 },
];

const LEAVE_RULE_BY_TYPE: Record<string, PayrollRuleKey> = {
  urlaub: 'leave_vacation',
  krankheit: 'leave_sick',
  schule: 'leave_school',
};

export function leaveRuleKeyForType(leaveType: string): PayrollRuleKey | null {
  return LEAVE_RULE_BY_TYPE[leaveType] ?? null;
}

export function mergeRuleConfig(
  ruleKey: PayrollRuleKey,
  stored?: Record<string, unknown>,
): Record<string, unknown> {
  return { ...DEFAULT_RULE_CONFIGS[ruleKey], ...(stored ?? {}) };
}

export function isRuleConfigured(ruleKey: PayrollRuleKey, config: Record<string, unknown>): boolean {
  switch (ruleKey) {
    case 'normal_hours':
    case 'lkw_hours':
    case 'driver_travel_time':
      return !!config.code;
    case 'driver_allowance':
    case 'passenger_travel_allowance':
      return !!(config.tax_free_code && config.taxable_code && config.amount_eur);
    case 'leave_vacation':
    case 'leave_sick':
    case 'leave_school':
    case 'bad_weather':
      return !!config.code;
    default:
      return false;
  }
}

export async function loadTenantPayrollConfig(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<TenantPayrollConfig> {
  const [{ data: rules }, { data: codes }] = await Promise.all([
    supabase.from('payroll_tenant_rules').select('*').eq('tenant_id', tenantId),
    supabase
      .from('payroll_booking_codes')
      .select('code, label, is_active')
      .eq('tenant_id', tenantId),
  ]);

  const rulesMap = new Map<PayrollRuleKey, PayrollTenantRule>();
  for (const key of PAYROLL_RULE_KEYS) {
    const row = (rules ?? []).find((r) => r.rule_key === key);
    rulesMap.set(key, {
      id: row?.id ?? '',
      tenant_id: tenantId,
      rule_key: key,
      enabled: row?.enabled ?? true,
      config: mergeRuleConfig(key, row?.config as Record<string, unknown>),
    });
  }

  const codeLabels: Record<string, string> = {};
  const activeCodes: string[] = [];
  for (const c of codes ?? []) {
    codeLabels[c.code] = c.label;
    if (c.is_active) activeCodes.push(c.code);
  }

  return { rules: rulesMap, codeLabels, activeCodes };
}

export async function seedPayrollDefaults(supabase: SupabaseClient, tenantId: string) {
  for (const seed of DEFAULT_BOOKING_CODE_SEED) {
    await supabase.from('payroll_booking_codes').upsert(
      {
        tenant_id: tenantId,
        ...seed,
        is_system: true,
        is_active: true,
      },
      { onConflict: 'tenant_id,code' },
    );
  }

  for (const key of PAYROLL_RULE_KEYS) {
    await supabase.from('payroll_tenant_rules').upsert(
      {
        tenant_id: tenantId,
        rule_key: key,
        enabled: true,
        config: DEFAULT_RULE_CONFIGS[key],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,rule_key' },
    );
  }

  const seasonRows = [
    [12, 1, 7.5], [12, 2, 7.5], [12, 3, 7.5], [12, 4, 7.5], [12, 5, 6.0],
    [1, 1, 7.5], [1, 2, 7.5], [1, 3, 7.5], [1, 4, 7.5], [1, 5, 6.0],
    [2, 1, 8.0], [2, 2, 8.0], [2, 3, 8.0], [2, 4, 8.0], [2, 5, 6.5],
    [3, 1, 8.5], [3, 2, 8.5], [3, 3, 8.5], [3, 4, 8.5], [3, 5, 6.5],
  ] as const;

  for (const [month, weekday, max_hours] of seasonRows) {
    await supabase.from('payroll_season_config').upsert(
      { tenant_id: tenantId, month, weekday, max_hours },
      { onConflict: 'tenant_id,month,weekday' },
    );
  }
}
