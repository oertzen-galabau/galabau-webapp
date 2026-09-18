import { deleteSiteAppointment, saveSiteAppointments } from '@/lib/actions/admin';
import { DynamicFormRows } from '@/components/ui/dynamic-form-rows';
import { SiteEntityDeleteButton } from '@/components/sites/site-entity-delete-button';

type Appointment = {
  id: string;
  title: string;
  appointment_at: string;
  notes: string | null;
};

type Props = {
  siteId: string;
  appointments: Appointment[];
  canEdit: boolean;
};

const APPOINTMENT_GRID = 'input-form-row-list-grid input-form-row-list-grid--appointment';

const APPOINTMENT_FIELDS = [
  { name: 'title[]', label: 'Titel', required: true, placeholder: 'z.B. Abnahme' },
  { name: 'appointment_date[]', label: 'Datum', type: 'date', required: true },
  { name: 'appointment_time[]', label: 'Uhrzeit', type: 'time', defaultValue: '08:00' },
  { name: 'notes[]', label: 'Notiz', placeholder: 'Optional' },
];

function formatAppointment(at: string) {
  return new Date(at).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SiteAppointmentsSection({ siteId, appointments, canEdit }: Props) {
  return (
    <section className="site-detail-section">
      <h2>Termine</h2>

      {appointments.length > 0 ? (
        <ul className="site-entity-list">
          {appointments.map((appointment) => (
            <li key={appointment.id} className="site-entity-row">
              <div className="site-entity-row-body">
                <strong>{appointment.title}</strong>
                <span>{formatAppointment(appointment.appointment_at)}</span>
                {appointment.notes && (
                  <div className="site-entity-row-meta">{appointment.notes}</div>
                )}
              </div>
              {canEdit && (
                <SiteEntityDeleteButton
                  id={appointment.id}
                  entityLabel="Termin"
                  onDelete={deleteSiteAppointment}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Keine Termine geplant.</p>
      )}

      {canEdit && (
        <form action={saveSiteAppointments} className="input-form site-appointments-add">
          <input type="hidden" name="site_id" value={siteId} />
          <DynamicFormRows fields={APPOINTMENT_FIELDS} gridClassName={APPOINTMENT_GRID} />
          <div className="input-form-actions">
            <button type="submit" className="primary-button primary-button--compact">Termine speichern</button>
          </div>
        </form>
      )}
    </section>
  );
}
