'use client';

import { useEffect, useState } from 'react';
import { AppDialog } from '@/components/ui/app-dialogs';
import { addSiteTeamMember } from '@/lib/actions/site-team';
import type { EmployeeTeamOption } from '@/lib/sites/foremen-options';

type Props = {
  siteId: string;
  employeeOptions: EmployeeTeamOption[];
  /** Ändert sich nach erfolgreichem Hinzufügen — schließt den Dialog. */
  resetKey: number;
};

export function SiteTeamAddDialog({ siteId, employeeOptions, resetKey }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [resetKey]);

  return (
    <>
      <button type="button" className="secondary-button secondary-button--compact" onClick={() => setOpen(true)}>
        Mitarbeiter hinzufügen
      </button>
      <AppDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Mitarbeiter hinzufügen"
        footer={
          open ? (
            <div className="dialog-actions">
              <button type="button" className="text-button" onClick={() => setOpen(false)}>
                Abbrechen
              </button>
              <button type="submit" form="site-team-add-form" className="primary-button primary-button--compact">
                Hinzufügen
              </button>
            </div>
          ) : null
        }
      >
        {open ? (
          <form id="site-team-add-form" action={addSiteTeamMember} className="input-form site-team-add-form">
            <input type="hidden" name="site_id" value={siteId} />
            <p className="muted site-team-add-form-lead">Mehrere Personen auswählen, dann Hinzufügen.</p>
            <ul className="site-team-picker-list">
              {employeeOptions.map((option) => (
                <li key={option.value}>
                  <label className="input-form-checkbox site-team-picker-option">
                    <input type="checkbox" name="user_id[]" value={option.value} />
                    <span>
                      {option.label} ({option.roleLabel})
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </form>
        ) : null}
      </AppDialog>
    </>
  );
}
