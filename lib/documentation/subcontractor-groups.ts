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
