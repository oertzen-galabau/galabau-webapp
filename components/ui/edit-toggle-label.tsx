import { Pencil } from 'lucide-react';

type Props = {
  /** false, wenn der Eltern-Button bereits aria-label="Bearbeiten" setzt (kein doppeltes Vorlesen). */
  announceForScreenReader?: boolean;
};

/** Sichtbares Stift-Icon; optional versteckter Text für Screenreader (z. B. bei summary ohne aria-label). */
export function EditToggleLabel({ announceForScreenReader = true }: Props) {
  return (
    <>
      <Pencil size={18} className="edit-toggle-label-icon" aria-hidden />
      {announceForScreenReader ? <span className="sr-only">Bearbeiten</span> : null}
    </>
  );
}
