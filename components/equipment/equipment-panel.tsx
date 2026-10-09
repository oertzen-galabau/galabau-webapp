import { createClient } from '@/lib/supabase/server';
import { canAccess, type SessionContext } from '@/lib/auth/session';
import { PartnerTabs } from '@/components/partners/partner-tabs';
import { EquipmentCreateForm } from '@/components/equipment/equipment-create-form';
import { EquipmentListClient, type EquipmentListItem } from '@/components/equipment/equipment-list-client';
import { EQUIPMENT_PHOTOS_BUCKET, getSignedFileUrls } from '@/lib/supabase/storage';
import type { TenantEquipment } from '@/lib/types/database';

type Props = {
  ctx: SessionContext;
};

export async function EquipmentPanel({ ctx }: Props) {
  if (!canAccess(ctx, 'nav.partners') || !canAccess(ctx, 'partners.view')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const canManage = canAccess(ctx, 'partners.manage');
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('tenant_equipment')
    .select('*')
    .eq('tenant_id', ctx.tenant!.id)
    .order('is_active', { ascending: false })
    .order('name');

  const list = (rows ?? []) as TenantEquipment[];
  const paths = list.map((r) => r.photo_path).filter(Boolean) as string[];
  const urlMap = await getSignedFileUrls(ctx.tenant!.id, EQUIPMENT_PHOTOS_BUCKET, paths);

  const items: EquipmentListItem[] = list.map((row) => ({
    ...row,
    photoUrl: row.photo_path ? urlMap.get(row.photo_path) ?? null : null,
  }));

  return (
    <>
      <PartnerTabs activeTab="fahrzeuge" />

      {canManage ? (
        <section className="panel form-panel" style={{ marginTop: 16 }}>
          <h2>Neu anlegen</h2>
          <EquipmentCreateForm />
        </section>
      ) : null}

      <section className="panel equipment-list-panel" style={{ marginTop: 16 }}>
        <EquipmentListClient items={items} canManage={canManage} />
      </section>
    </>
  );
}
