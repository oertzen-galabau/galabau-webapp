type RequestRow = {
  id: string;
  created_at: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string;
  status: string;
};

type Props = {
  requests: RequestRow[];
};

export function SuperadminRequestsPanel({ requests }: Props) {
  return (
    <section className="panel superadmin-tab-panel">
      <h2>Anfragen (Marketing)</h2>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Firma</th>
              <th className="data-table-col--optional">Kontakt</th>
              <th>E-Mail</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Keine Anfragen
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id}>
                  <td>{new Date(req.created_at).toLocaleDateString('de-DE')}</td>
                  <td>{req.company_name}</td>
                  <td className="data-table-col--optional">{req.contact_name}</td>
                  <td>{req.contact_email}</td>
                  <td>{req.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
