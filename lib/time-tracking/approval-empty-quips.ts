const APPROVAL_EMPTY_QUIPS = [
  'Keine Zeiten warten — der Rasen mäht sich selbst.',
  'Freigabe-Inbox leer. Entweder war es ein ruhiger Tag, oder jemand war sehr fleißig.',
  'Alles geprüft. Du darfst kurz die Hände in den Hosentaschen stecken.',
  'Kein Stempel nötig — die Stoppuhr macht Pause.',
  'Null offene Einträge. Selbst der Kaffee ist beeindruckt.',
  'Die Freigabe-Schlange ist kürzer als ein Mittagspausenblick.',
  'Alles erledigt. Zeit für einen kurzen Gang ans Fenster — oder ans Beet.',
  'Keine Zeiten in der Warteschleife. Büro-Modus: grün.',
] as const;

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function approvalEmptyQuip(seed?: string): string {
  const daySeed = seed ?? new Date().toISOString().slice(0, 10);
  const index = hashSeed(daySeed) % APPROVAL_EMPTY_QUIPS.length;
  return APPROVAL_EMPTY_QUIPS[index]!;
}
