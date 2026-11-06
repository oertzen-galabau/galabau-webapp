import { createClient } from '@/lib/supabase/server';
import { canAccess, type SessionContext } from '@/lib/auth/session';
import { EquipmentTypeCreateForm } from '@/components/equipment/equipment-type-create-form';
import { EquipmentTypeRow } from '@/components/equipment/equipment-type-row';
import type { TenantEquipmentType } from '@/lib/types/database';

type Props = {
  ctx: SessionContext;
};

export async function EquipmentTypesPanel({ ctx }: Props) {
  const canManage = canAccess(ctx, 'partners.manage');
  const supabase = await createClient();
  const tenantId = ctx.tenant!.id;

  const [{ data: typeRows }, { data: usageRows }] = await Promise.all([
    supabase
      .from('tenant_equipment_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('sort_order')
      .order('name'),
    supabase.from('tenant_equipment').select('equipment_type_id').eq('tenant_id', tenantId),
  ]);

  const list = (typeRows ?? []) as TenantEquipmentType[];
  const usageByType = new Map<string, number>();
  for (const row of usageRows ?? []) {
    const typeId = row.equipment_type_id as string;
    usageByType.set(typeId, (usageByType.get(typeId) ?? 0) + 1);
  }

  const nextSortOrder = list.reduce((max, row) => Math.max(max, row.sort_order), 0) + 10;

  return (
    <section className="panel form-panel equipment-types-panel">
      <h2>Typen</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Typen für Fahrzeuge, Geräte und Anhänger – z. B. LKW, Bagger oder eigene Kategorien. Standardtypen
        können umbenannt, deaktiviert oder gelöscht werden (Löschen nur ohne zugeordnete Einträge).
      </p>

      {canManage ? <EquipmentTypeCreateForm nextSortOrder={nextSortOrder} /> : null}

      {list.length > 0 ? (
        <div className="work-area-list equipment-type-list" style={{ marginTop: 16 }}>
          {list.map((type) => (
            <EquipmentTypeRow
              key={type.id}
              type={type}
              canManage={canManage}
              usageCount={usageByType.get(type.id) ?? 0}
            />
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 16 }}>
          Noch keine Typen angelegt. Legen Sie mindestens einen Typ an, bevor Sie Einträge erstellen.
        </p>
      )}
    </section>
  );
}
