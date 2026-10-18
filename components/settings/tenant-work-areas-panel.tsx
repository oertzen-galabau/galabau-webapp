import { createClient } from '@/lib/supabase/server';
import { canAccess, type SessionContext } from '@/lib/auth/session';
import { WorkAreaCreateForm } from '@/components/settings/work-area-create-form';
import { WorkAreaRow } from '@/components/settings/work-area-row';
import type { TenantWorkArea } from '@/lib/types/database';

type Props = {
  ctx: SessionContext;
};

export async function TenantWorkAreasPanel({ ctx }: Props) {
  if (!canAccess(ctx, 'settings.work_areas')) {
    return <p className="muted">Keine Berechtigung.</p>;
  }

  const canManage = canAccess(ctx, 'settings.work_areas');
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('tenant_work_areas')
    .select('*')
    .eq('tenant_id', ctx.tenant!.id)
    .order('sort_order')
    .order('name');

  const list = (rows ?? []) as TenantWorkArea[];
  const nextSortOrder =
    list.reduce((max, row) => Math.max(max, row.sort_order), 0) + 10;

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Bereiche gruppieren Mitarbeiter für die Einsatzplanung (z. B. Baustelle, Verwaltung).
        Die Berufbezeichnung bleibt für Rapporte unverändert.
      </p>

      {canManage ? (
        <section className="panel form-panel" style={{ marginTop: 16 }}>
          <h2>Neuer Bereich</h2>
          <WorkAreaCreateForm nextSortOrder={nextSortOrder} />
        </section>
      ) : null}

      <section className="panel work-area-list" style={{ marginTop: 16 }}>
        {list.length > 0 ? (
          <>
            <div className="work-area-list-header" aria-hidden="true">
              <span>Bereich</span>
              <span>Einsatzplan</span>
              <span />
            </div>
            {list.map((area) => (
              <WorkAreaRow key={area.id} area={area} canManage={canManage} />
            ))}
          </>
        ) : (
          <p className="muted" style={{ padding: '1rem 1.25rem' }}>
            Noch keine Bereiche angelegt.
          </p>
        )}
      </section>
    </>
  );
}
