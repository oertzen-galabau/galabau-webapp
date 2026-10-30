import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canAccess, requireTenantMember } from '@/lib/auth/session';
import { TenantBrandingForm } from '@/components/settings/tenant-branding-form';
import { TenantStartPasswordForm } from '@/components/settings/tenant-start-password-form';
import {
  saveCompanyHoliday,
  deleteCompanyHoliday,
  saveBridgeDay,
  deleteBridgeDay,
} from '@/lib/actions/admin';
import { PayrollRuleMatrix } from '@/components/payroll/payroll-rule-matrix';
import { SettingsTabs } from '@/components/settings/settings-tabs';
import { loadTenantPayrollConfig, serializeTenantConfig } from '@/lib/payroll/tenant-rules';
import { BusinessPartnersPanel } from '@/components/partners/business-partners-panel';
import { isPartnerTab, type PartnerTabId } from '@/lib/partners/kind';
import { isSettingsTab, visibleSettingsTabs, type SettingsTabId } from '@/lib/settings/tabs';
import { TenantTimeTrackingForm } from '@/components/settings/tenant-time-tracking-form';
import { TenantOrderBudgetForm } from '@/components/settings/tenant-order-budget-form';
import { TenantReportLabelsForm } from '@/components/settings/tenant-report-labels-form';
import { TenantBadWeatherAllowanceForm } from '@/components/settings/tenant-bad-weather-allowance-form';
import { TenantLeaveCarryExpiryForm } from '@/components/settings/tenant-leave-carry-expiry-form';
import { TenantWorkAreasPanel } from '@/components/settings/tenant-work-areas-panel';
import { TenantGpsForm } from '@/components/settings/tenant-gps-form';
import { loadTenantTimeTrackingRules } from '@/lib/time-tracking/break-rules';
import { formatGermanDate } from '@/lib/schedule/week';
import type { PayrollBookingCode, TenantTimeTrackingRules } from '@/lib/types/database';

const SETTINGS_DATE: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

function formatSettingsDate(iso: string): string {
  return formatGermanDate(iso, SETTINGS_DATE);
}

type PageProps = {
  searchParams: Promise<{ tab?: string; partners?: string }>;
};

export default async function EinstellungenPage({ searchParams }: PageProps) {
  const { tab: tabParam, partners: partnersParam } = await searchParams;

  const ctx = await requireTenantMember();

  const tabs = visibleSettingsTabs(new Set(ctx.permissions), ctx.isSuperadminBypass);
  if (tabs.length === 0) {
    return <p className="muted">Keine Berechtigung.</p>;
  }
  const activeTab: SettingsTabId = isSettingsTab(tabParam) && tabs.some((t) => t.id === tabParam)
    ? tabParam
    : tabs[0].id;

  const activePartnerTab: PartnerTabId = isPartnerTab(partnersParam) ? partnersParam : 'subunternehmer';

  const supabase = await createClient();
  const tenantId = ctx.tenant!.id;

  const needsCalendarData = activeTab === 'allgemein';
  const needsTenantRow =
    needsCalendarData || activeTab === 'bestellbudget' || activeTab === 'berichte' || activeTab === 'gps';
  const { data: tenant } = needsTenantRow
    ? await supabase.from('tenants').select('*').eq('id', tenantId).single()
    : { data: null };
  const { data: holidays } = needsCalendarData
    ? await supabase
        .from('company_holidays')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('start_date', { ascending: false })
    : { data: null };
  const { data: bridgeDays } = needsCalendarData
    ? await supabase
        .from('bridge_days')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('date', { ascending: false })
    : { data: null };

  let codes: PayrollBookingCode[] = [];
  let tenantConfig = null;
  let defaultStartPassword: string | null = null;
  let timeTrackingRules: TenantTimeTrackingRules | null = null;

  if (activeTab === 'startpasswort' && canAccess(ctx, 'settings.start_password')) {
    const admin = createAdminClient();
    const { data: startPasswordRow } = await admin
      .from('tenants')
      .select('default_start_password')
      .eq('id', tenantId)
      .single();
    defaultStartPassword = startPasswordRow?.default_start_password ?? null;
  }

  if (activeTab === 'zeiterfassung' && canAccess(ctx, 'settings.time_tracking')) {
    timeTrackingRules = await loadTenantTimeTrackingRules(supabase, tenantId);
  }

  if (activeTab === 'lohnregeln' && canAccess(ctx, 'settings.payroll_rules')) {
    const [codesResult, loadedConfig] = await Promise.all([
      supabase
        .from('payroll_booking_codes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('sort_order'),
      loadTenantPayrollConfig(supabase, tenantId),
    ]);
    codes = (codesResult.data ?? []) as PayrollBookingCode[];
    tenantConfig = loadedConfig;
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Mandanten-Einstellungen</h1>
          <p>
            {activeTab === 'lohnregeln'
              ? 'Lohnregeln und Buchungsnummern für die automatische Verbuchung.'
              : activeTab === 'zeiterfassung'
                ? 'Regeln für erwartete Pausen und Pflichtbegründungen in der Zeiterfassung.'
              : activeTab === 'startpasswort'
                ? 'Einheitliches Startpasswort für alle Mitarbeiter-Accounts verwalten.'
                : activeTab === 'bestellbudget'
                  ? 'Standard-Jahresbudget für Arbeitskleidung pro Mitarbeiter.'
                  : activeTab === 'stammdaten'
                    ? 'Subunternehmer, Lieferanten, Ansprechpartner und Fahrzeuge & Geräte für Baustellen und Einsatzplanung.'
                    : activeTab === 'bereiche'
                      ? 'Bereiche für Mitarbeiter (Baustelle, Verwaltung …) und Filter in der Einsatzplanung.'
                    : activeTab === 'gps'
                      ? 'Standortfunktionen (GPS) für alle Mitarbeiter ein- oder ausschalten.'
                    : activeTab === 'berichte'
                      ? 'Anzeigenamen für Tagesbericht und Std.-Lohn-Rapport in der App und in PDFs.'
                : 'Logo, Firmenname, Markenfarben und Betriebskalender anpassen.'}
          </p>
        </div>
      </div>

      <SettingsTabs tabs={tabs} activeTab={activeTab} />

      {activeTab === 'startpasswort' && canAccess(ctx, 'settings.start_password') ? (
        <TenantStartPasswordForm
          configured={Boolean(defaultStartPassword)}
          currentPassword={defaultStartPassword}
        />
      ) : null}

      {activeTab === 'lohnregeln' && tenantConfig ? (
        <PayrollRuleMatrix
          codes={codes}
          tenantConfig={serializeTenantConfig(tenantConfig)}
        />
      ) : null}

      {activeTab === 'zeiterfassung' && timeTrackingRules ? (
        <TenantTimeTrackingForm rules={timeTrackingRules} />
      ) : null}

      {activeTab === 'bestellbudget' && canAccess(ctx, 'orders.manage_budget') && tenant ? (
        <TenantOrderBudgetForm
          defaultBudgetEur={tenant.default_clothing_order_budget_eur != null
            ? Number(tenant.default_clothing_order_budget_eur)
            : null}
        />
      ) : null}

      {activeTab === 'stammdaten' ? (
        <BusinessPartnersPanel ctx={ctx} activePartnerTab={activePartnerTab} />
      ) : null}

      {activeTab === 'bereiche' ? <TenantWorkAreasPanel ctx={ctx} /> : null}

      {activeTab === 'gps' && canAccess(ctx, 'settings.gps') && tenant ? (
        <TenantGpsForm gpsEnabled={tenant.gps_enabled !== false} />
      ) : null}

      {activeTab === 'berichte' && canAccess(ctx, 'settings.branding') && tenant ? (
        <TenantReportLabelsForm tenant={tenant} />
      ) : null}

      {activeTab === 'allgemein' ? (
        <>
          {canAccess(ctx, 'settings.branding') && tenant ? (
            <TenantBrandingForm tenant={tenant} />
          ) : null}

          <section className="panel form-panel" style={{ marginTop: 16 }}>
            <h2>Betriebsurlaub</h2>
            <p className="muted">Betriebsferien und geschlossene Zeiträume, die für alle Mitarbeiter gelten.</p>
            {!holidays?.length ? (
              <p className="muted settings-period-list-empty">Keine Einträge</p>
            ) : (
              <ul className="settings-period-list">
                {(holidays ?? []).map((h) => (
                  <li key={h.id} className="settings-period-list-row">
                    <div className="settings-period-list-main">
                      <span className="settings-period-list-title">{h.title}</span>
                      <span className="settings-period-list-range muted">
                        {formatSettingsDate(h.start_date)} – {formatSettingsDate(h.end_date)}
                      </span>
                    </div>
                    <form action={deleteCompanyHoliday} className="settings-period-list-action">
                      <input type="hidden" name="id" value={h.id} />
                      <button type="submit" className="text-button">
                        Löschen
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={saveCompanyHoliday} className="input-form" style={{ marginTop: 8 }}>
              <div className="input-form-core input-form-core--period-row">
                <label>Bezeichnung<input name="title" placeholder="z.B. Betriebsferien Sommer" required /></label>
                <label>Von<input type="date" name="start_date" required /></label>
                <label>Bis<input type="date" name="end_date" required /></label>
              </div>
              <div className="input-form-actions">
                <button type="submit" className="primary-button primary-button--compact">Betriebsurlaub anlegen</button>
              </div>
            </form>
          </section>

          <section className="panel form-panel" style={{ marginTop: 16 }}>
            <h2>Brückentage</h2>
            <p className="muted">Einzelne freie Tage, die für alle Mitarbeiter gelten.</p>
            {!bridgeDays?.length ? (
              <p className="muted settings-period-list-empty">Keine Einträge</p>
            ) : (
              <ul className="settings-period-list">
                {(bridgeDays ?? []).map((b) => (
                  <li key={b.id} className="settings-period-list-row">
                    <div className="settings-period-list-main">
                      <span className="settings-period-list-title">{b.title}</span>
                      <span className="settings-period-list-range muted">{formatSettingsDate(b.date)}</span>
                    </div>
                    <form action={deleteBridgeDay} className="settings-period-list-action">
                      <input type="hidden" name="id" value={b.id} />
                      <button type="submit" className="text-button">
                        Löschen
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={saveBridgeDay} className="input-form" style={{ marginTop: 8 }}>
              <div className="input-form-core input-form-core--period-row input-form-core--period-row-2">
                <label>Bezeichnung<input name="title" placeholder="z.B. Brückentag nach Feiertag" required /></label>
                <label>Datum<input type="date" name="date" required /></label>
              </div>
              <div className="input-form-actions">
                <button type="submit" className="primary-button primary-button--compact">Brückentag anlegen</button>
              </div>
            </form>
          </section>

          {canAccess(ctx, 'settings.holidays') && tenant ? (
            <>
              <TenantLeaveCarryExpiryForm
                expireMonth={tenant.leave_carry_expire_month ?? null}
                expireDay={tenant.leave_carry_expire_day ?? null}
              />
              <TenantBadWeatherAllowanceForm
                allowanceDays={tenant.bad_weather_allowance_days ?? 5}
              />
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
