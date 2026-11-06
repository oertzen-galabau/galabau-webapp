import { createClient } from '@/lib/supabase/server';
import { canAccess, type SessionContext } from '@/lib/auth/session';
import { PartnerTabs } from '@/components/partners/partner-tabs';
import { EquipmentCreateForm } from '@/components/equipment/equipment-create-form';
import { EquipmentListClient, type EquipmentListItem } from '@/components/equipment/equipment-list-client';
import { EquipmentTypesPanel } from '@/components/equipment/equipment-types-panel';
import { EQUIPMENT_PHOTOS_BUCKET, getSignedFileUrls } from '@/lib/supabase/storage';
import type { TenantEquipment, TenantEquipmentType } from '@/lib/types/database';

type Props = {
  ctx: SessionContext;
};

type EquipmentRow = TenantEquipment & {
  tenant_equipment_types: { name: string } | null;
};

export async function EquipmentPanel({ ctx }: Props) {
  if (!canAccess(ctx, 'nav.partners') || !canAccess(ctx, 'partners.view')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const canManage = canAccess(ctx, 'partners.manage');
  const supabase = await createClient();
  const tenantId = ctx.tenant!.id;

  const [{ data: rows }, { data: typeRows }] = await Promise.all([
    supabase
      .from('tenant_equipment')
      .select('*, tenant_equipment_types ( name )')
      .eq('tenant_id', tenantId)
      .order('is_active', { ascending: false })
      .order('name'),
    supabase
      .from('tenant_equipment_types')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name'),
  ]);

  const types = ((typeRows ?? []) as TenantEquipmentType[]).sort((a, b) =>
    a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }),
  );
  const activeTypes = types.filter((type) => type.is_active);
  const list = (rows ?? []) as EquipmentRow[];
  const paths = list.map((r) => r.photo_path).filter(Boolean) as string[];
  const urlMap = await getSignedFileUrls(tenantId, EQUIPMENT_PHOTOS_BUCKET, paths);

  const items: EquipmentListItem[] = list.map((row) => ({
    ...row,
    typeName: row.tenant_equipment_types?.name ?? '—',
    photoUrl: row.photo_path ? urlMap.get(row.photo_path) ?? null : null,
  }));

  return (
    <>
      <PartnerTabs activeTab="fahrzeuge" />

      <div style={{ marginTop: 16 }}>
        <EquipmentTypesPanel ctx={ctx} />
      </div>

      {canManage ? (
        <section className="panel form-panel" style={{ marginTop: 16 }}>
          <h2>Neu anlegen</h2>
          {activeTypes.length > 0 ? (
            <EquipmentCreateForm types={activeTypes} />
          ) : (
            <p className="muted">Bitte zuerst mindestens einen aktiven Typ anlegen.</p>
          )}
        </section>
      ) : null}

      <section className="panel equipment-list-panel" style={{ marginTop: 16 }}>
        <EquipmentListClient items={items} types={types} canManage={canManage} />
      </section>
    </>
  );
}
