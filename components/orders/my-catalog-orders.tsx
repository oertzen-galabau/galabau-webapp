'use client';

import { useState, useTransition } from 'react';
import { cancelCatalogOrder } from '@/lib/actions/orders';
import { downloadOrderPdf } from '@/lib/orders/download-pdf-client';
import { formatOrderEuro, ORDER_STATUS_LABELS } from '@/lib/orders/labels';
import type { CatalogOrder, CatalogOrderItem, ClothingOrder } from '@/lib/types/database';

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

  function cancel(orderId: string) {
    const formData = new FormData();
    formData.set('order_id', orderId);
    startTransition(async () => {
      await cancelCatalogOrder(formData);
    });
  }

  return (
    <>
      <section className="panel">
        <h2>Meine Bestellungen</h2>
        {orders.length === 0 && <p className="muted">Noch keine Katalog-Bestellungen.</p>}
        {orders.map((order) => (
          <details key={order.id} className="order-detail-block" style={{ marginBottom: 12 }}>
            <summary>
              {new Date(order.created_at).toLocaleDateString('de-DE')}
              {' · '}
              {formatOrderEuro(order.total_eur)}
              {order.own_share_eur > 0 && ` · Eigenanteil ${formatOrderEuro(order.own_share_eur)}`}
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
                    {line.article_number ? ` (${line.article_number})` : ''}
                    {' · '}
                    Gr. {line.size}, {line.quantity}×
                    {' · '}
                    {line.unit_price_eur != null ? formatOrderEuro(line.line_total_eur) : '—'}
                    {line.name_print ? ` · Namensdruck: ${line.name_print}` : ''}
                  </li>
                ))}
            </ul>
            {order.notes && <p className="muted">Notiz: {order.notes}</p>}
            {canDownloadPdf ? (
              <button
                type="button"
                className="secondary-button secondary-button--compact"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  setPdfError(null);
                  const err = await downloadOrderPdf([order.id]);
                  if (err) setPdfError(err);
                }}
              >
                Bestellformular PDF
              </button>
            ) : null}
            {order.status === 'pending' && (
              <button
                type="button"
                className="text-button"
                disabled={pending}
                onClick={() => cancel(order.id)}
              >
                Bestellung zurückziehen
              </button>
            )}
          </details>
        ))}
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
                    <td>{ORDER_STATUS_LABELS[order.status] ?? order.status}</td>
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
