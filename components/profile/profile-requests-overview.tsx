import Link from 'next/link';
import { formatLeaveType } from '@/lib/leave/labels';
import { formatOrderEuro, ORDER_STATUS_LABELS } from '@/lib/orders/labels';

type LeaveRow = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
};

type CatalogOrderRow = {
  id: string;
  created_at: string;
  total_eur: number;
  own_share_eur: number;
  status: string;
};

type LegacyOrderRow = {
  id: string;
  created_at: string;
  item_type: string;
  size: string;
  status: string;
};

type Props = {
  leaveRequests: LeaveRow[];
  catalogOrders: CatalogOrderRow[];
  clothingOrders: LegacyOrderRow[];
};

export function ProfileRequestsOverview({ leaveRequests, catalogOrders, clothingOrders }: Props) {
  return (
    <section className="panel profile-requests-overview">
      <h2>Meine Anträge & Bestellungen</h2>
      <div className="profile-requests-grid">
        <div>
          <h3>Urlaub & Fehlzeiten</h3>
          {leaveRequests.length === 0 ? (
            <p className="muted">Noch keine Anträge.</p>
          ) : (
            <ul className="simple-list">
              {leaveRequests.map((req) => (
                <li key={req.id}>
                  <strong>{formatLeaveType(req.leave_type, req.notes)}</strong>
                  {' · '}
                  {req.start_date} – {req.end_date}
                  {' · '}
                  <span className="status-badge">{req.status}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/app/urlaub" className="text-button">Alle Urlaubsanträge →</Link>
        </div>
        <div>
          <h3>Arbeitskleidung</h3>
          {catalogOrders.length === 0 && clothingOrders.length === 0 ? (
            <p className="muted">Noch keine Bestellungen.</p>
          ) : (
            <ul className="simple-list">
              {catalogOrders.map((order) => (
                <li key={order.id}>
                  <strong>{formatOrderEuro(order.total_eur)}</strong>
                  {order.own_share_eur > 0 ? ` (Eigenanteil ${formatOrderEuro(order.own_share_eur)})` : ''}
                  {' · '}
                  {new Date(order.created_at).toLocaleDateString('de-DE')}
                  {' · '}
                  <span className="status-badge">{ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status}</span>
                </li>
              ))}
              {clothingOrders.map((order) => (
                <li key={order.id}>
                  <strong>{order.item_type}</strong> Gr. {order.size}
                  {' · '}
                  {new Date(order.created_at).toLocaleDateString('de-DE')}
                  {' · '}
                  <span className="status-badge">{order.status}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/app/bestellungen" className="text-button">Alle Bestellungen →</Link>
        </div>
      </div>
    </section>
  );
}
