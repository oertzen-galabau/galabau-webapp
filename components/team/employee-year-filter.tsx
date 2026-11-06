'use client';

import { useRouter } from 'next/navigation';
import { AppSelect } from '@/components/ui/app-select';

type Props = {
  tabBasePath: string;
  selectedYear: number;
  /** Two-digit month from URL (`month` param), preserved when changing year */
  monthPart: string;
  years: number[];
};

export function EmployeeYearFilter({ tabBasePath, selectedYear, monthPart, years }: Props) {
  const router = useRouter();
  const options = years.map((y) => ({ value: String(y), label: String(y) }));

  return (
    <div className="employee-year-filter">
      <span className="employee-year-filter-label">Jahr</span>
      <AppSelect
        value={String(selectedYear)}
        onValueChange={(year) => {
          const params = new URLSearchParams({
            tab: 'overview',
            month: `${year}-${monthPart}`,
          });
          router.push(`${tabBasePath}?${params.toString()}`);
        }}
        options={options}
        allowEmpty={false}
        aria-label="Jahr filtern"
        className="employee-year-filter-select"
      />
    </div>
  );
}
