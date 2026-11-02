import { describe, it } from 'node:test';

/**
 * Manuelle Abnahme (Intervall-Zeiterfassung) — siehe Plan „Abnahme-Szenarien“.
 * Diese Tests dienen als Checkliste in CI (always green).
 */
describe('Abnahme-Szenarien Zeiterfassung Intervalle', () => {
  it('1: Laden → Anfahrt → Frühstück → Feierabend mit bestätigten Pausen', () => {});

  it('2: Eine Pause → Feierabend erzwingt Typ-Bestätigung', () => {});

  it('3: Reload während Pause — Zustand Pause, Timer steht', () => {});

  it('4: Manuelle Nachbearbeitung auf /app/zeiten bleibt segment-basiert', () => {});

  it('5: Einsatzplan 07:30, Start 06:50 mit Feature — Dialog + Grund in Freigabe', () => {});

  it('6: Feature aus oder kein Einsatz — Start ohne Plan-Dialog', () => {});
});
