import { createClient } from '@/lib/supabase/server';
import { canAccess, getTenantIdForSession, requireTenantMember } from '@/lib/auth/session';
import { OrderTabs } from '@/components/orders/order-tabs';
import { OrderCatalogManager } from '@/components/orders/order-catalog-manager';
import { OrderCartForm, type CatalogItemForOrder } from '@/components/orders/order-cart-form';
import { OrderBudgetMetrics } from '@/components/orders/order-budget-metrics';
import { MyCatalogOrders, type CatalogOrderWithItems } from '@/components/orders/my-catalog-orders';
import { OrderAdminPanel, type AdminCatalogOrder } from '@/components/orders/order-admin-panel';
import { loadClothingOrderBudgetBreakdown } from '@/lib/orders/load-budget';
import { loadOrderCatalogSizePresets } from '@/lib/orders/load-size-presets';
import type { SizePresetsMap } from '@/lib/orders/catalog-sizes';
import {
  isOrderTab,
  resolveCatalogSubTab,
  visibleOrderTabs,
  type OrderTabId,
} from '@/lib/orders/tabs';
import type { ClothingOrder, OrderCatalogCategory, OrderCatalogSizeOption } from '@/lib/types/database';

type PageProps = {
  searchParams: Promise<{ tab?: string; katalog?: string }>;
};

export default async function BestellungenPage({ searchParams }: PageProps) {
  const { tab: tabParam, katalog: katalogParam } = await searchParams;

  const ctx = await requireTenantMember();
  if (!canAccess(ctx, 'nav.bestellungen')) return <p className="muted">Keine Berechtigung.</p>;

  const tabs = visibleOrderTabs(ctx.permissions, ctx.isSuperadminBypass);
  const activeTab: OrderTabId = isOrderTab(tabParam) && tabs.some((t) => t.id === tabParam)
    ? tabParam
    : tabs[0].id;

  const tenantId = await getTenantIdForSession(ctx);
  if (!tenantId) {
    return (
      <p className="muted">
        Kein Mandantenkontext. Bitte über die Subdomain Ihres Betriebs zugreifen.
      </p>
    );
  }

  const supabase = await createClient();
  const year = new Date().getFullYear();

  let categories: OrderCatalogCategory[] = [];
  let catalogItemsForOrder: CatalogItemForOrder[] = [];
  let catalogItemsAdmin: Awaited<ReturnType<typeof loadCatalogItemsAdmin>> = [];
  let myCatalogOrders: CatalogOrderWithItems[] = [];
  let legacyOrders: ClothingOrder[] = [];
  let adminOrders: AdminCatalogOrder[] = [];
  let budgetBreakdown = await loadClothingOrderBudgetBreakdown(supabase, tenantId, ctx.userId, year);
  let sizePresets: SizePresetsMap = { clothing: [], shoes: [] };
  let sizeOptionRows: OrderCatalogSizeOption[] = [];

  if (activeTab === 'bestellen') {
    const [catRes, itemRes, ordersRes, legacyRes, budget, presets] = await Promise.all([
      supabase.from('order_catalog_categories').select('*').eq('tenant_id', tenantId).order('sort_order').order('name'),
      supabase
        .from('order_catalog_items')
        .select('*, order_catalog_categories(name, sort_order, size_kind)')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('clothing_style'),
      supabase
        .from('catalog_orders')
        .select('*, catalog_order_items(*)')
        .eq('tenant_id', tenantId)
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('clothing_orders')
        .select('*')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false }),
      loadClothingOrderBudgetBreakdown(supabase, tenantId, ctx.userId, year),
      loadOrderCatalogSizePresets(supabase, tenantId),
    ]);
    categories = catRes.data ?? [];
    catalogItemsForOrder = (itemRes.data ?? []) as CatalogItemForOrder[];
    myCatalogOrders = (ordersRes.data ?? []) as CatalogOrderWithItems[];
    legacyOrders = legacyRes.data ?? [];
    budgetBreakdown = budget;
    sizePresets = presets;
  }

  if (activeTab === 'alle' && canAccess(ctx, 'orders.manage')) {
    const { data } = await supabase
      .from('catalog_orders')
      .select('*, catalog_order_items(*), profiles(first_name, last_name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    adminOrders = (data ?? []) as AdminCatalogOrder[];
  }

  if (activeTab === 'katalog' && canAccess(ctx, 'orders.manage_catalog')) {
    const [catRes, itemRes, presets, sizeRowsRes] = await Promise.all([
      loadCatalogCategories(supabase, tenantId),
      loadCatalogItemsAdmin(supabase, tenantId),
      loadOrderCatalogSizePresets(supabase, tenantId),
      supabase
        .from('order_catalog_size_options')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('kind')
        .order('sort_order')
        .order('value'),
    ]);
    categories = catRes;
    catalogItemsAdmin = itemRes;
    sizePresets = presets;
    sizeOptionRows = (sizeRowsRes.data ?? []) as OrderCatalogSizeOption[];
  }

  const catalogSubTab = resolveCatalogSubTab(katalogParam);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Bestellungen</span>
          <h1>Schuhe & Kleidung</h1>
          <p>Betriebskatalog, Budget und Bestellungen.</p>
        </div>
      </div>

      {tabs.length > 1 && (
        <OrderTabs tabs={tabs} activeTab={activeTab} />
      )}

      {activeTab === 'bestellen' && (
        <div style={{ marginTop: tabs.length > 1 ? 16 : 0 }}>
          <OrderBudgetMetrics breakdown={budgetBreakdown} />
          <div style={{ marginTop: 16 }}>
            <OrderCartForm
              categories={categories}
              items={catalogItemsForOrder}
              budget={budgetBreakdown}
              sizePresets={sizePresets}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <MyCatalogOrders orders={myCatalogOrders} legacyOrders={legacyOrders} />
          </div>
        </div>
      )}

      {activeTab === 'alle' && canAccess(ctx, 'orders.manage') && (
        <div style={{ marginTop: tabs.length > 1 ? 16 : 0 }}>
          <OrderAdminPanel orders={adminOrders} />
        </div>
      )}

      {activeTab === 'katalog' && canAccess(ctx, 'orders.manage_catalog') && (
        <div style={{ marginTop: tabs.length > 1 ? 16 : 0 }}>
          <OrderCatalogManager
            categories={categories}
            items={catalogItemsAdmin}
            activeSubTab={catalogSubTab}
            sizePresets={sizePresets}
            sizeOptionRows={sizeOptionRows}
          />
        </div>
      )}
    </>
  );
}

async function loadCatalogCategories(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
) {
  const { data } = await supabase
    .from('order_catalog_categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order')
    .order('name');
  return data ?? [];
}

async function loadCatalogItemsAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
) {
  const { data } = await supabase
    .from('order_catalog_items')
    .select('*, order_catalog_categories(id, name, size_kind)')
    .eq('tenant_id', tenantId)
    .order('clothing_style');
  return data ?? [];
}
