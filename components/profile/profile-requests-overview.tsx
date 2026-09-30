import Link from 'next/link';
import { formatLeaveType } from '@/lib/leave/labels';

type LeaveRow = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
};

type OrderRow = {
  id: string;
  created_at: string;
  item_type: string;
  size: string;
  status: string;
};

type Props = {
  leaveRequests: LeaveRow[];
  clothingOrders: OrderRow[];
};

export function ProfileRequestsOverview({ leaveRequests, clothingOrders }: Props) {
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
          {clothingOrders.length === 0 ? (
            <p className="muted">Noch keine Bestellungen.</p>
          ) : (
            <ul className="simple-list">
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
