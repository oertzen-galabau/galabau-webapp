import { formatMinutes } from '@/lib/utils/time';
import { blockDurationMinutes } from '@/lib/time-tracking/timeline';
import type { TimeBlockType } from '@/lib/types/database';

export type SiteApprovedTimeEntry = {
  id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  profiles: { first_name: string; last_name: string } | null;
  blocks: {
    block_type: TimeBlockType;
    start_time: string;
    end_time: string;
  }[];
};

type Props = {
  entries: SiteApprovedTimeEntry[];
};

export function SiteTimeEntriesSection({ entries }: Props) {
  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <h2>Freigegebene Baustellenzeiten</h2>
      <p className="muted">
        Nur freigegebene Arbeitsblöcke auf dieser Baustelle. Wege- und Pausenzeiten sind hier nicht enthalten.
      </p>

      {entries.length === 0 ? (
        <p className="muted">Noch keine freigegebenen Zeiten für diese Baustelle.</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Mitarbeiter</th>
                <th>Von</th>
                <th>Bis</th>
                <th>Dauer</th>
              </tr>
            </thead>
            <tbody>
              {entries.flatMap((entry) =>
                entry.blocks.map((block, index) => (
                  <tr key={`${entry.id}-${index}`}>
                    <td>{index === 0 ? entry.work_date : ''}</td>
                    <td>
                      {index === 0 && entry.profiles
                        ? `${entry.profiles.first_name} ${entry.profiles.last_name}`
                        : ''}
                    </td>
                    <td>{block.start_time.slice(0, 5)}</td>
                    <td>{block.end_time.slice(0, 5)}</td>
                    <td>{formatMinutes(blockDurationMinutes(block))}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
