'use client';

import { useMemo } from 'react';
import { updateRolePermissions } from '@/lib/actions/permissions';
import { PERMISSION_CATALOG, type PermissionKey } from '@/lib/auth/permissions';

export function RoleMatrixForm({
  roleId,
  grantedKeys,
}: {
  roleId: string;
  grantedKeys: PermissionKey[];
}) {
  const granted = useMemo(() => new Set(grantedKeys), [grantedKeys]);
  const groups = useMemo(() => {
    const map = new Map<string, typeof PERMISSION_CATALOG>();
    for (const item of PERMISSION_CATALOG) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, []);

  return (
    <form action={updateRolePermissions} className="permission-matrix">
      <input type="hidden" name="role_id" value={roleId} />
      {groups.map(([group, items]) => (
        <fieldset key={group} className="permission-group">
          <legend>{group}</legend>
          <div className="permission-grid">
            {items.map((item) => (
              <label key={item.key} className="permission-check">
                <input
                  type="checkbox"
                  name={`perm_${item.key}`}
                  defaultChecked={granted.has(item.key)}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button type="submit" className="primary-button">Berechtigungen speichern</button>
    </form>
  );
}
