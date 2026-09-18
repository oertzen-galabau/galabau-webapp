'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setDevRoleOverride } from '@/lib/actions/dev-role';
import type { TenantRole } from '@/lib/types/database';
import { AppSelect } from '@/components/ui/app-select';

export function RoleSwitcher({
  tenantRoles,
  actualRoleId,
  devRoleOverrideId,
  actualRoleName,
}: {
  tenantRoles: TenantRole[];
  actualRoleId: string | null;
  devRoleOverrideId: string | null;
  actualRoleName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(value: string) {
    startTransition(async () => {
      await setDevRoleOverride(value === '' ? null : value);
      router.refresh();
    });
  }

  const options = tenantRoles.map((role) => ({ value: role.id, label: role.name }));

  return (
    <div className="dev-role-switcher">
      <label className="dev-role-select-label">
        <span>Dev-Rolle</span>
        <AppSelect
          value={devRoleOverrideId ?? ''}
          onValueChange={handleChange}
          disabled={pending}
          aria-label="Entwicklungs-Rolle simulieren"
          placeholder={`Eigene Rolle (${actualRoleName ?? '—'})`}
          options={options}
        />
      </label>
    </div>
  );
}
