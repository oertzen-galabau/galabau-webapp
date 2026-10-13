export type SubcontractorDisplayRow = {
  company_name: string;
  work_description: string | null;
  hours: number;
  worker_name?: string | null;
  group_key?: string | null;
};

export type SubcontractorDisplayGroup = {
  groupKey: string;
  companyName: string;
  workDescription: string | null;
  persons: SubcontractorDisplayRow[];
  totalHours: number;
};

function groupKeyFor(row: SubcontractorDisplayRow): string {
  return row.group_key ?? `legacy:${row.company_name}`;
}

export type SubcontractorFormGroup = {
  groupKey: string;
  partnerId: string | null;
  companyName: string;
  workDescription: string | null;
  workers: Array<{ workerName: string | null; hours: number }>;
};

export function buildSubcontractorFormGroups(
  rows: Array<{
    id: string;
    group_key: string | null;
    partner_id: string | null;
    company_name: string;
    work_description: string | null;
    worker_name: string | null;
    hours: number | null;
  }>,
): SubcontractorFormGroup[] {
  const map = new Map<string, SubcontractorFormGroup>();

  for (const row of rows) {
    const key = row.group_key ?? row.id;
    let group = map.get(key);
    if (!group) {
      group = {
        groupKey: key,
        partnerId: row.partner_id,
        companyName: row.company_name,
        workDescription: row.work_description,
        workers: [],
      };
      map.set(key, group);
    }
    if (row.partner_id) group.partnerId = row.partner_id;
    group.workers.push({
      workerName: row.worker_name,
      hours: Number(row.hours) || 0,
    });
  }

  return [...map.values()];
}

export type SubcontractorFormSubmitGroup = {
  groupKey: string;
  partnerId: string;
  companyName: string;
  workDescription: string;
  workers: Array<{ workerName: string; hours: string }>;
};

const SUBCONTRACTOR_FORM_ARRAY_KEYS = [
  'subcontractor_group_key[]',
  'subcontractor_partner_id[]',
  'subcontractor_company_name[]',
  'subcontractor_work_description[]',
  'subcontractor_worker_name[]',
  'subcontractor_hours[]',
] as const;

export function clearSubcontractorFormFields(formData: FormData) {
  for (const key of SUBCONTRACTOR_FORM_ARRAY_KEYS) {
    while (formData.has(key)) {
      formData.delete(key);
    }
  }
}

/** Subunternehmer-Daten aus dem React-State in FormData schreiben (Submit-Quelle der Wahrheit). */
export function appendSubcontractorGroupsToFormData(
  formData: FormData,
  groups: SubcontractorFormSubmitGroup[],
) {
  clearSubcontractorFormFields(formData);

  for (const group of groups) {
    const partnerId = group.partnerId.trim();
    const companyName = group.companyName.trim();
    const workDescription = group.workDescription.trim();
    if (!partnerId && !companyName && !workDescription) continue;

    const activeWorkers = group.workers.filter(
      (worker) => worker.workerName.trim() || Number(String(worker.hours).replace(',', '.')) > 0,
    );
    const workersToSubmit =
      activeWorkers.length > 0 ? activeWorkers : [{ workerName: '', hours: '0' }];

    for (const worker of workersToSubmit) {
      formData.append('subcontractor_group_key[]', group.groupKey);
      formData.append('subcontractor_partner_id[]', partnerId);
      formData.append('subcontractor_company_name[]', companyName);
      formData.append('subcontractor_work_description[]', workDescription);
      formData.append('subcontractor_worker_name[]', worker.workerName.trim());
      formData.append('subcontractor_hours[]', worker.hours.trim() || '0');
    }
  }
}

export function groupSubcontractorEntries(rows: SubcontractorDisplayRow[]): SubcontractorDisplayGroup[] {
  const map = new Map<string, SubcontractorDisplayGroup>();

  for (const row of rows) {
    const key = groupKeyFor(row);
    let group = map.get(key);
    if (!group) {
      group = {
        groupKey: key,
        companyName: row.company_name,
        workDescription: row.work_description,
        persons: [],
        totalHours: 0,
      };
      map.set(key, group);
    }
    group.persons.push(row);
    group.totalHours += Number(row.hours) || 0;
  }

  return [...map.values()];
}
