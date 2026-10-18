import { AppSelect } from '@/components/ui/app-select';
import type { TenantWorkArea } from '@/lib/types/database';

type Props = {
  areas: Pick<TenantWorkArea, 'id' | 'name' | 'is_active'>[];
  defaultValue?: string | null;
  disabled?: boolean;
  required?: boolean;
};

export function WorkAreaSelect({ areas, defaultValue, disabled, required }: Props) {
  const active = areas.filter((a) => a.is_active);
  const options = active.map((a) => ({ value: a.id, label: a.name }));

  return (
    <AppSelect
      name="work_area_id"
      allowEmpty={!required}
      placeholder="— kein Bereich —"
      disabled={disabled}
      defaultValue={defaultValue ?? ''}
      options={options}
    />
  );
}
