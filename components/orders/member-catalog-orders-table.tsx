'use client';

import { Fragment, useState } from 'react';
import { formatOrderEuro, ORDER_STATUS_LABELS, orderStatusBadgeClass } from '@/lib/orders/labels';
import type { CatalogOrder, CatalogOrderItem } from '@/lib/types/database';
import { OrderLineItemsList } from '@/components/orders/order-line-items-list';

export type MemberCatalogOrder = CatalogOrder & {
  catalog_order_items: CatalogOrderItem[];
};

type Props = {
  orders: MemberCatalogOrder[];
};

export function MemberCatalogOrdersTable({ orders }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function toggleExpanded(orderId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  if (orders.length === 0) return <p className="muted">Keine Bestellungen.</p>;

  return (
    <div className="data-table-wrap">
      <table className="data-table order-orders-table">
        <thead>
          <tr>
            <th scope="col">Datum</th>
            <th scope="col">Summe</th>
            <th scope="col">Status</th>
            <th scope="col">Positionen</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const lineCount = order.catalog_order_items.length;
            const isExpanded = expanded.has(order.id);
            return (
              <Fragment key={order.id}>
                <tr>
                  <td>{new Date(order.created_at).toLocaleDateString('de-DE')}</td>
                  <td>{formatOrderEuro(order.total_eur)}</td>
                  <td>
                    <span className={`status-badge ${orderStatusBadgeClass(order.status)}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(order.id)}
                    >
                      {lineCount} Position{lineCount === 1 ? '' : 'en'}
                      {isExpanded ? ' ▲' : ' ▼'}
                    </button>
                  </td>
                </tr>
                {isExpanded ? (
                  <tr className="order-positions-row">
                    <td colSpan={4}>
                      <OrderLineItemsList items={order.catalog_order_items} showLineTotals />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
