'use client';

import { Fragment, useState, useTransition } from 'react';
import { cancelCatalogOrder } from '@/lib/actions/orders';
import { downloadOrderPdf } from '@/lib/orders/download-pdf-client';
import { formatOrderEuro, ORDER_STATUS_LABELS, orderStatusBadgeClass } from '@/lib/orders/labels';
import type { CatalogOrder, CatalogOrderItem, ClothingOrder } from '@/lib/types/database';
import { OrderLineItemsList } from '@/components/orders/order-line-items-list';

export type CatalogOrderWithItems = CatalogOrder & {
  catalog_order_items: CatalogOrderItem[];
};

type Props = {
  orders: CatalogOrderWithItems[];
  legacyOrders: ClothingOrder[];
  canDownloadPdf?: boolean;
};

export function MyCatalogOrders({ orders, legacyOrders, canDownloadPdf = false }: Props) {
  const [pending, startTransition] = useTransition();
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function cancel(orderId: string) {
    const formData = new FormData();
    formData.set('order_id', orderId);
    startTransition(async () => {
      await cancelCatalogOrder(formData);
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

  return (
    <>
      <section className="panel">
        <h2>Meine Bestellungen</h2>
        {orders.length === 0 && <p className="muted">Noch keine Katalog-Bestellungen.</p>}
        {orders.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table order-orders-table">
              <thead>
                <tr>
                  <th scope="col">Datum</th>
                  <th scope="col">Summe</th>
                  <th scope="col">Status</th>
                  <th scope="col">Aktionen</th>
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
                        <td>
                          {formatOrderEuro(order.total_eur)}
                          {order.own_share_eur > 0 && (
                            <span className="muted" style={{ display: 'block', fontSize: 'var(--text-caption)' }}>
                              Eigenanteil {formatOrderEuro(order.own_share_eur)}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${orderStatusBadgeClass(order.status)}`}>
                            {ORDER_STATUS_LABELS[order.status]}
                          </span>
                        </td>
                        <td>
                          <div className="inline-actions">
                            {canDownloadPdf ? (
                              <button
                                type="button"
                                className="secondary-button secondary-button--compact"
                                onClick={async () => {
                                  setPdfError(null);
                                  const err = await downloadOrderPdf([order.id]);
                                  if (err) setPdfError(err);
                                }}
                              >
                                PDF
                              </button>
                            ) : null}
                            {order.status === 'pending' ? (
                              <button
                                type="button"
                                className="text-button"
                                disabled={pending}
                                onClick={() => cancel(order.id)}
                              >
                                Zurückziehen
                              </button>
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
                          <td colSpan={4}>
                            <OrderLineItemsList items={order.catalog_order_items} showLineTotals />
                            {order.notes ? <p className="muted" style={{ marginTop: 8 }}>Notiz: {order.notes}</p> : null}
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
        {pdfError ? <p className="form-error" style={{ marginTop: 8 }}>{pdfError}</p> : null}
      </section>

      {legacyOrders.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>Ältere Bestellungen</h2>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Datum</th><th>Artikel</th><th>Größe</th><th>Menge</th><th>Status</th></tr>
              </thead>
              <tbody>
                {legacyOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{new Date(order.created_at).toLocaleDateString('de-DE')}</td>
                    <td>{order.item_type}</td>
                    <td>{order.size}</td>
                    <td>{order.quantity}</td>
                    <td>
                      <span className={`status-badge ${orderStatusBadgeClass(order.status)}`}>
                        {ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
