'use client';

import { useMemo, useState, useTransition } from 'react';
import { updateCatalogOrderStatus } from '@/lib/actions/orders';
import { formatOrderEuro, ORDER_STATUS_LABELS } from '@/lib/orders/labels';
import type { CatalogOrder, CatalogOrderItem, ClothingStatus } from '@/lib/types/database';
import { AppSelect } from '@/components/ui/app-select';

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
};

export function OrderAdminPanel({ orders }: Props) {
  const [pending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

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

  function setStatus(orderId: string, status: ClothingStatus) {
    const formData = new FormData();
    formData.set('order_id', orderId);
    formData.set('status', status);
    startTransition(async () => {
      await updateCatalogOrderStatus(formData);
    });
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

      {filtered.length === 0 && <p className="muted">Keine Bestellungen für den Filter.</p>}

      {filtered.map((order) => {
        const employee = order.profiles
          ? `${order.profiles.first_name} ${order.profiles.last_name}`.trim()
          : '—';
        return (
          <details key={order.id} className="order-detail-block" style={{ marginBottom: 12 }}>
            <summary>
              {new Date(order.created_at).toLocaleDateString('de-DE')}
              {' · '}
              {employee}
              {' · '}
              {formatOrderEuro(order.total_eur)}
              {' · '}
              {ORDER_STATUS_LABELS[order.status]}
            </summary>
            <ul className="simple-list">
              {order.catalog_order_items
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((line) => (
                  <li key={line.id}>
                    {line.category_name}: {line.clothing_style}
                    {' · '}
                    Gr. {line.size}, {line.quantity}×
                    {line.name_print ? ` · Namensdruck: ${line.name_print}` : ''}
                  </li>
                ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 8 }}>
              <span className="muted">Status:</span>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={order.status === opt.value ? 'primary-button primary-button--compact' : 'secondary-button secondary-button--compact'}
                  disabled={pending || order.status === opt.value}
                  onClick={() => setStatus(order.id, opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </details>
        );
      })}
    </section>
  );
}
