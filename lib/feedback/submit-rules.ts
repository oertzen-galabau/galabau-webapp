/** Mindestlänge der Beschreibung bei Bug-Meldungen */
export const FEEDBACK_BUG_DESCRIPTION_MIN_LENGTH = 30;

export function bugSubmitError(description: string, screenshotCount: number): string | null {
  if (description.trim().length < FEEDBACK_BUG_DESCRIPTION_MIN_LENGTH) {
    return `Beschreibung: mindestens ${FEEDBACK_BUG_DESCRIPTION_MIN_LENGTH} Zeichen`;
  }
  if (screenshotCount < 1) {
    return 'Bei Bugs ist mindestens ein Foto erforderlich';
  }
  return null;
}
