'use client';

import { Fragment, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateCatalogOrderStatus } from '@/lib/actions/orders';
import { downloadOrderPdf } from '@/lib/orders/download-pdf-client';
import { formatOrderEuro, ORDER_STATUS_LABELS, orderStatusBadgeClass } from '@/lib/orders/labels';
import type { CatalogOrder, CatalogOrderItem, ClothingStatus } from '@/lib/types/database';
import { AppSelect } from '@/components/ui/app-select';
import { OrderLineItemsList } from '@/components/orders/order-line-items-list';
import { OrderSendDialog } from '@/components/orders/order-send-dialog';

export type AdminCatalogOrder = CatalogOrder & {
  catalog_order_items: CatalogOrderItem[];
  profiles: { first_name: string; last_name: string } | null;
};

const STATUS_OPTIONS: { value: ClothingStatus; label: string }[] = [
  { value: 'pending', label: 'Offen' },
  { value: 'ordered', label: 'Bestellt' },
  { value: 'delivered', label: 'Geliefert' },
];

type Props = {
  orders: AdminCatalogOrder[];
  canShare: boolean;
  canManage: boolean;
};

export function OrderAdminPanel({ orders, canShare, canManage }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [sendOpen, setSendOpen] = useState(false);
  const [sendOrderIds, setSendOrderIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const order of orders) {
      const name = order.profiles
        ? `${order.profiles.first_name} ${order.profiles.last_name}`.trim()
        : order.user_id;
      map.set(order.user_id, name);
    }
    return [{ value: '', label: 'Alle Mitarbeiter' }, ...[...map.entries()].map(([value, label]) => ({ value, label }))];
  }, [orders]);

  const filtered = orders.filter((order) => {
    if (statusFilter && order.status !== statusFilter) return false;
    if (userFilter && order.user_id !== userFilter) return false;
    return true;
  });

  const selectedInFilter = filtered.filter((o) => selected.has(o.id));
  const colCount = (canShare ? 1 : 0) + 5;

  function toggleSelect(orderId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(orderId);
      else next.delete(orderId);
      return next;
    });
  }

  function selectAllFiltered(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const o of filtered) {
        if (checked) next.add(o.id);
        else next.delete(o.id);
      }
      return next;
    });
  }

  function toggleExpanded(orderId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function setStatus(orderId: string, status: ClothingStatus) {
    const formData = new FormData();
    formData.set('order_id', orderId);
    formData.set('status', status);
    startTransition(async () => {
      await updateCatalogOrderStatus(formData);
    });
  }

  async function downloadPdf(orderIds: string[]) {
    setActionError(null);
    const err = await downloadOrderPdf(orderIds);
    if (err) setActionError(err);
  }

  function openSend(orderIds: string[]) {
    setSendOrderIds(orderIds);
    setSendOpen(true);
  }

  return (
    <section className="panel">
      <h2>Alle Bestellungen</h2>
      <div className="flex flex-wrap items-end gap-4" style={{ marginBottom: 16 }}>
        <label>
          Status
          <AppSelect
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[{ value: '', label: 'Alle' }, ...STATUS_OPTIONS]}
            allowEmpty={false}
          />
        </label>
        <label>
          Mitarbeiter
          <AppSelect
            value={userFilter}
            onValueChange={setUserFilter}
            options={userOptions}
            allowEmpty={false}
          />
        </label>
      </div>

      {canShare && filtered.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2"
          style={{ marginBottom: 16, padding: '10px 12px', background: 'var(--surface-muted, #f5f3ef)', borderRadius: 8 }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
            <input
              type="checkbox"
              checked={filtered.length > 0 && selectedInFilter.length === filtered.length}
              onChange={(e) => selectAllFiltered(e.target.checked)}
            />
            Alle sichtbaren auswählen
          </label>
          <span className="muted">{selected.size} ausgewählt</span>
          <button
            type="button"
            className="secondary-button secondary-button--compact"
            disabled={selected.size === 0}
            onClick={() => downloadPdf([...selected])}
          >
            Sammelformular PDF
          </button>
          <button
            type="button"
            className="secondary-button secondary-button--compact"
            disabled={selected.size === 0}
            onClick={() => openSend([...selected])}
          >
            Sammelformular per Mail
          </button>
        </div>
      ) : null}

      {actionError ? <p className="form-error" style={{ marginBottom: 12 }}>{actionError}</p> : null}

      {filtered.length === 0 && <p className="muted">Keine Bestellungen für den Filter.</p>}

      {filtered.length > 0 ? (
        <div className="data-table-wrap">
          <table className="data-table order-orders-table">
            <thead>
              <tr>
                {canShare ? (
                  <th scope="col" aria-label="Auswahl" />
                ) : null}
                <th scope="col">Datum</th>
                <th scope="col">Mitarbeiter</th>
                <th scope="col">Summe</th>
                <th scope="col">Status</th>
                <th scope="col">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => {
                const employee = order.profiles
                  ? `${order.profiles.first_name} ${order.profiles.last_name}`.trim()
                  : '—';
                const lineCount = order.catalog_order_items.length;
                const isExpanded = expanded.has(order.id);
                return (
                  <Fragment key={order.id}>
                    <tr>
                      {canShare ? (
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(order.id)}
                            onChange={(e) => toggleSelect(order.id, e.target.checked)}
                            aria-label="Bestellung auswählen"
                          />
                        </td>
                      ) : null}
                      <td>{new Date(order.created_at).toLocaleDateString('de-DE')}</td>
                      <td>{employee}</td>
                      <td>{formatOrderEuro(order.total_eur)}</td>
                      <td className="order-orders-table__status">
                        {canManage ? (
                          <AppSelect
                            value={order.status}
                            onValueChange={(v) => setStatus(order.id, v as ClothingStatus)}
                            options={STATUS_OPTIONS}
                            allowEmpty={false}
                            disabled={pending}
                            aria-label={`Status für ${employee}`}
                          />
                        ) : (
                          <span className={`status-badge ${orderStatusBadgeClass(order.status)}`}>
                            {ORDER_STATUS_LABELS[order.status]}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="inline-actions">
                          {canShare ? (
                            <>
                              <button
                                type="button"
                                className="secondary-button secondary-button--compact"
                                onClick={() => downloadPdf([order.id])}
                              >
                                PDF
                              </button>
                              <button
                                type="button"
                                className="secondary-button secondary-button--compact"
                                onClick={() => openSend([order.id])}
                              >
                                Mail
                              </button>
                            </>
                          ) : null}
                          <button
                            type="button"
                            className="text-button"
                            aria-expanded={isExpanded}
                            onClick={() => toggleExpanded(order.id)}
                          >
                            {lineCount} Position{lineCount === 1 ? '' : 'en'}
                            {isExpanded ? ' ▲' : ' ▼'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="order-positions-row">
                        <td colSpan={colCount}>
                          <OrderLineItemsList items={order.catalog_order_items} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {canShare ? (
        <OrderSendDialog
          key={sendOrderIds.join(',') || 'none'}
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          orderIds={sendOrderIds}
          canMarkOrdered={canManage}
          onSent={() => router.refresh()}
        />
      ) : null}
    </section>
  );
}
