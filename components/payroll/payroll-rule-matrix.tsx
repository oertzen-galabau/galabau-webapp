'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DEFAULT_RULE_CONFIGS,
  PAYROLL_RULE_CATALOG,
  type PayrollRuleKey,
  type SerializableTenantPayrollConfig,
} from '@/lib/payroll/tenant-rules';
import {
  saveBookingCode,
  saveTenantRule,
  deactivateBookingCode,
  deactivateTenantRule,
} from '@/lib/actions/payroll';
import { House, Trash2, UserRound } from 'lucide-react';
import { AppDialog, ConfirmDialog } from '@/components/ui/app-dialogs';
import { AppSelect } from '@/components/ui/app-select';
import {
  DeleteIconAction,
  EditIconAction,
  IconActionButton,
  TableIconActions,
} from '@/components/ui/icon-action-button';
import type { PayrollBookingCode } from '@/lib/types/database';

const UNIT_OPTIONS = [
  { value: 'hours', label: 'Stunden' },
  { value: 'eur', label: 'Euro' },
];

type Props = {
  codes: PayrollBookingCode[];
  tenantConfig: SerializableTenantPayrollConfig;
};

function ruleUsesDualCodes(key: PayrollRuleKey) {
  return key === 'driver_allowance' || key === 'passenger_travel_allowance';
}

function ruleUsesTravelThreshold(key: PayrollRuleKey) {
  return key === 'driver_travel_time' || key === 'passenger_travel_allowance';
}

function ruleUsesMinWork(key: PayrollRuleKey) {
  return key === 'bad_weather';
}

function configValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') {
    return na === nb;
  }
  return String(a ?? '') === String(b ?? '');
}

function isRuleConfigCustomized(ruleKey: PayrollRuleKey, config: Record<string, string | number>): boolean {
  const defaults = DEFAULT_RULE_CONFIGS[ruleKey];
  return Object.entries(defaults).some(([key, defaultValue]) => {
    const current = config[key];
    const effective = current === undefined || current === '' ? defaultValue : current;
    return !configValuesEqual(effective, defaultValue);
  });
}

function RuleKindBadge({ kind }: { kind: 'standard' | 'individual' }) {
  const label = kind === 'standard' ? 'Standard-Regel' : 'Individuelle Regel';
  const Icon = kind === 'standard' ? House : UserRound;

  return (
    <span
      className={`payroll-rule-kind payroll-rule-kind--${kind}`}
      title={label}
      aria-label={label}
      role="img"
    >
      <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
    </span>
  );
}

function formatRuleSummary(ruleKey: PayrollRuleKey, config: Record<string, string | number>): string {
  const parts: string[] = [];
  const dual = ruleUsesDualCodes(ruleKey);
  const travel = ruleUsesTravelThreshold(ruleKey);
  const minWork = ruleUsesMinWork(ruleKey);

  if (dual) {
    if (config.tax_free_code) parts.push(String(config.tax_free_code));
    if (config.taxable_code) parts.push(String(config.taxable_code));
    if (config.amount_eur != null && config.amount_eur !== '') parts.push(`${config.amount_eur} €`);
    if (config.threshold_minutes != null && config.threshold_minutes !== '') {
      parts.push(`ab ${config.threshold_minutes} Min`);
    }
    if (travel && config.travel_threshold_minutes != null && config.travel_threshold_minutes !== '') {
      parts.push(`Wegezeit ab ${config.travel_threshold_minutes} Min`);
    }
  } else if (travel && !dual) {
    if (config.code) parts.push(String(config.code));
    if (config.threshold_minutes != null && config.threshold_minutes !== '') {
      parts.push(`ab ${config.threshold_minutes} Min`);
    }
  } else if (minWork) {
    if (config.code) parts.push(String(config.code));
    if (config.min_work_minutes != null && config.min_work_minutes !== '') {
      parts.push(`min. ${config.min_work_minutes} Min Arbeit`);
    }
    if (config.season_start && config.season_end) {
      parts.push(`Saison ${config.season_start}–${config.season_end}`);
    }
  } else if (config.code) {
    parts.push(String(config.code));
  }

  return parts.length ? parts.join(' · ') : '—';
}

function CodeSelect({
  name,
  label,
  codes,
  defaultValue,
}: {
  name: string;
  label: string;
  codes: PayrollBookingCode[];
  defaultValue?: string;
}) {
  return (
    <label className="dialog-field">
      {label}
      <AppSelect
        name={name}
        defaultValue={defaultValue ?? ''}
        options={codes.map((c) => ({ value: c.code, label: `${c.code} — ${c.label}` }))}
      />
    </label>
  );
}

function RuleDetailFields({
  ruleKey,
  config,
  activeCodes,
}: {
  ruleKey: PayrollRuleKey;
  config: Record<string, string | number>;
  activeCodes: PayrollBookingCode[];
}) {
  const dual = ruleUsesDualCodes(ruleKey);
  const travel = ruleUsesTravelThreshold(ruleKey);
  const minWork = ruleUsesMinWork(ruleKey);
  const simple = !dual && !travel && !minWork;

  return (
    <div className="payroll-rule-detail-fields payroll-rule-detail-fields--dialog">
      {(simple || (travel && !dual) || minWork) && (
        <CodeSelect
          name="cfg_code"
          label="Buchungsnr."
          codes={activeCodes}
          defaultValue={String(config.code ?? '')}
        />
      )}
      {dual && (
        <>
          <CodeSelect
            name="cfg_tax_free_code"
            label="Steuerfrei"
            codes={activeCodes}
            defaultValue={String(config.tax_free_code ?? '')}
          />
          <CodeSelect
            name="cfg_taxable_code"
            label="Steuerpflichtig"
            codes={activeCodes}
            defaultValue={String(config.taxable_code ?? '')}
          />
          <label className="dialog-field">
            Betrag €
            <input
              type="number"
              name="cfg_amount_eur"
              step="0.01"
              min={0}
              defaultValue={config.amount_eur ?? ''}
            />
          </label>
          <label className="dialog-field">
            Schwelle Min.
            <input
              type="number"
              name="cfg_threshold_minutes"
              min={0}
              defaultValue={config.threshold_minutes ?? ''}
            />
          </label>
        </>
      )}
      {travel && (
        <label className="dialog-field">
          Wegezeit ab Min.
          <input
            type="number"
            name={dual ? 'cfg_travel_threshold_minutes' : 'cfg_threshold_minutes'}
            min={0}
            defaultValue={
              dual
                ? (config.travel_threshold_minutes ?? '')
                : (config.threshold_minutes ?? '')
            }
          />
        </label>
      )}
      {minWork && (
        <>
          <label className="dialog-field">
            Min. Arbeit Min.
            <input
              type="number"
              name="cfg_min_work_minutes"
              min={0}
              defaultValue={config.min_work_minutes ?? ''}
            />
          </label>
          <label className="dialog-field">
            Saison von (MM-TT)
            <input
              type="text"
              name="cfg_season_start"
              placeholder="12-01"
              pattern="\d{2}-\d{2}"
              defaultValue={String(config.season_start ?? '')}
            />
          </label>
          <label className="dialog-field">
            Saison bis (MM-TT)
            <input
              type="text"
              name="cfg_season_end"
              placeholder="03-31"
              pattern="\d{2}-\d{2}"
              defaultValue={String(config.season_end ?? '')}
            />
          </label>
        </>
      )}
    </div>
  );
}

function RuleEditDialog({
  open,
  onClose,
  ruleKey,
  label,
  description,
  config,
  enabled,
  activeCodes,
}: {
  open: boolean;
  onClose: () => void;
  ruleKey: PayrollRuleKey;
  label: string;
  description: string;
  config: Record<string, string | number>;
  enabled: boolean;
  activeCodes: PayrollBookingCode[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await saveTenantRule(formData);
      onClose();
      router.refresh();
    });
  }

  return (
    <AppDialog open={open} onClose={onClose} title={label}>
      <p className="muted">{description}</p>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="rule_key" value={ruleKey} />
        <label className="input-form-checkbox dialog-field">
          <input type="checkbox" name="enabled" defaultChecked={enabled} disabled={pending} />
          Regel aktiv
        </label>
        <RuleDetailFields ruleKey={ruleKey} config={config} activeCodes={activeCodes} />
        <div className="dialog-actions">
          <button type="button" className="text-button" onClick={onClose} disabled={pending}>
            Abbrechen
          </button>
          <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
            {pending ? 'Bitte warten…' : 'Speichern'}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}

function RuleRow({
  ruleKey,
  label,
  description,
  config,
  enabled,
  activeCodes,
}: {
  ruleKey: PayrollRuleKey;
  label: string;
  description: string;
  config: Record<string, string | number>;
  enabled: boolean;
  activeCodes: PayrollBookingCode[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const summary = formatRuleSummary(ruleKey, config);
  const ruleKind = isRuleConfigCustomized(ruleKey, config) ? 'individual' : 'standard';

  function confirmDelete() {
    const formData = new FormData();
    formData.set('rule_key', ruleKey);
    startTransition(async () => {
      await deactivateTenantRule(formData);
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <tr className="data-table-row">
        <td>
          <span className={`status-badge${enabled ? ' active' : ''}`}>
            {enabled ? 'Aktiv' : 'Inaktiv'}
          </span>
        </td>
        <td><RuleKindBadge kind={ruleKind} /></td>
        <td><strong>{label}</strong></td>
        <td className="payroll-rule-summary muted">{summary}</td>
        <td className="data-table-actions">
          <TableIconActions>
            <EditIconAction onClick={() => setEditOpen(true)} disabled={pending} />
            <IconActionButton
              label="Deaktivieren"
              variant="danger"
              disabled={pending}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={18} />
            </IconActionButton>
          </TableIconActions>
        </td>
      </tr>
      <RuleEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        ruleKey={ruleKey}
        label={label}
        description={description}
        config={config}
        enabled={enabled}
        activeCodes={activeCodes}
      />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Regel deaktivieren"
        message={`Regel «${label}» wirklich deaktivieren? Sie wird nicht mehr bei der Buchung berücksichtigt.`}
        confirmLabel="Deaktivieren"
        danger
        pending={pending}
      />
    </>
  );
}

function CustomCodeEditDialog({
  open,
  onClose,
  code,
}: {
  open: boolean;
  onClose: () => void;
  code: PayrollBookingCode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await saveBookingCode(formData);
      onClose();
      router.refresh();
    });
  }

  return (
    <AppDialog open={open} onClose={onClose} title={`Code ${code.code}`}>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="id" value={code.id} />
        <label className="dialog-field">
          Code
          <input name="code" defaultValue={code.code} required disabled={pending} />
        </label>
        <label className="dialog-field">
          Bezeichnung
          <input name="label" defaultValue={code.label} required disabled={pending} />
        </label>
        <label className="dialog-field">
          Einheit
          <AppSelect
            name="unit"
            defaultValue={code.unit}
            options={UNIT_OPTIONS}
            allowEmpty={false}
            required
            disabled={pending}
          />
        </label>
        <label className="input-form-checkbox dialog-field">
          <input type="checkbox" name="is_tax_free" defaultChecked={code.is_tax_free} disabled={pending} />
          Steuerfrei
        </label>
        <div className="dialog-actions">
          <button type="button" className="text-button" onClick={onClose} disabled={pending}>
            Abbrechen
          </button>
          <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
            {pending ? 'Bitte warten…' : 'Speichern'}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}

function CustomCodeRow({ code }: { code: PayrollBookingCode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function confirmDelete() {
    const formData = new FormData();
    formData.set('id', code.id);
    startTransition(async () => {
      await deactivateBookingCode(formData);
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <tr className="data-table-row">
        <td><RuleKindBadge kind="individual" /></td>
        <td><strong>{code.code}</strong></td>
        <td>{code.label}</td>
        <td>{code.unit === 'eur' ? '€' : 'Std.'}{code.is_tax_free ? ' · steuerfrei' : ''}</td>
        <td className="data-table-actions">
          <TableIconActions>
            <EditIconAction onClick={() => setEditOpen(true)} disabled={pending} />
            <DeleteIconAction disabled={pending} onClick={() => setDeleteOpen(true)} />
          </TableIconActions>
        </td>
      </tr>
      <CustomCodeEditDialog open={editOpen} onClose={() => setEditOpen(false)} code={code} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Buchungsnummer löschen"
        message={`Code «${code.code} — ${code.label}» wirklich deaktivieren?`}
        confirmLabel="Löschen"
        danger
        pending={pending}
      />
    </>
  );
}

function CustomCodesDialog({
  open,
  onClose,
  customCodes,
}: {
  open: boolean;
  onClose: () => void;
  customCodes: PayrollBookingCode[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      await saveBookingCode(formData);
      form.reset();
      router.refresh();
    });
  }

  return (
    <AppDialog open={open} onClose={onClose} title="Zusätzliche Buchungsnummern">
      <p className="muted">
        Eigene Codes für Sonderfälle. System-Codes werden über die Regel-Matrix zugeordnet.
      </p>
      {customCodes.length > 0 ? (
        <div className="data-table-wrap payroll-custom-codes-table">
          <table className="data-table payroll-rule-matrix">
            <thead>
              <tr>
                <th>Art</th>
                <th>Code</th>
                <th>Bezeichnung</th>
                <th>Einheit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {customCodes.map((c) => (
                <CustomCodeRow key={c.id} code={c} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">Keine zusätzlichen Codes.</p>
      )}
      <form onSubmit={handleCreate} className="payroll-custom-code-form">
        <h3 className="payroll-custom-code-form__title">Neuen Code anlegen</h3>
        <label className="dialog-field">
          Code
          <input name="code" required placeholder="z. B. 2001" disabled={pending} />
        </label>
        <label className="dialog-field">
          Bezeichnung
          <input name="label" required disabled={pending} />
        </label>
        <label className="dialog-field">
          Einheit
          <AppSelect
            name="unit"
            defaultValue="hours"
            options={UNIT_OPTIONS}
            allowEmpty={false}
            required
            disabled={pending}
          />
        </label>
        <label className="input-form-checkbox dialog-field">
          <input type="checkbox" name="is_tax_free" disabled={pending} />
          Steuerfrei
        </label>
        <div className="dialog-actions">
          <button type="button" className="text-button" onClick={onClose} disabled={pending}>
            Schließen
          </button>
          <button type="submit" className="primary-button primary-button--compact" disabled={pending}>
            {pending ? 'Bitte warten…' : 'Code anlegen'}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}

export function PayrollRuleMatrix({ codes, tenantConfig }: Props) {
  const [customCodesOpen, setCustomCodesOpen] = useState(false);
  const activeCodes = codes.filter((c) => c.is_active);
  const customCodes = codes.filter((c) => !c.is_system && c.is_active);
  const rulesByKey = new Map(tenantConfig.rules.map((r) => [r.rule_key, r]));

  return (
    <>
      <section className="panel" style={{ marginBottom: 16 }}>
        <div className="payroll-matrix-header">
          <div>
            <h2>Lohnregeln & Buchungsnummern</h2>
            <p className="muted">
              Haus = Standard-Regel · Mensch = individuelle Anpassung
            </p>
          </div>
          <button
            type="button"
            className="primary-button primary-button--compact"
            onClick={() => setCustomCodesOpen(true)}
          >
            Zusätzliche Buchungsnummern
          </button>
        </div>
        <div className="data-table-wrap">
          <table className="data-table payroll-rule-matrix">
            <thead>
              <tr>
                <th>Status</th>
                <th>Art</th>
                <th>Regel</th>
                <th>Zuordnung</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {PAYROLL_RULE_CATALOG.map((def) => {
                const rule = rulesByKey.get(def.key);
                const config = (rule?.config ?? {}) as Record<string, string | number>;
                return (
                  <RuleRow
                    key={def.key}
                    ruleKey={def.key}
                    label={def.label}
                    description={def.description}
                    config={config}
                    enabled={rule?.enabled !== false}
                    activeCodes={activeCodes}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <CustomCodesDialog
        open={customCodesOpen}
        onClose={() => setCustomCodesOpen(false)}
        customCodes={customCodes}
      />
    </>
  );
}
