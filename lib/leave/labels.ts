export const LEAVE_TYPE_LABELS: Record<string, string> = {
  urlaub: 'Urlaub',
  krankheit: 'Krankheit',
  arzt: 'Arzt',
  amt: 'Amt',
  sonstige: 'Sonstige',
  schule: 'Schule',
};

export function formatLeaveType(type: string, notes?: string | null): string {
  const label = LEAVE_TYPE_LABELS[type] ?? type;
  if (type === 'sonstige' && notes) return `${label} (${notes})`;
  return label;
}
