export type MemberAccessStatus = 'inactive' | 'invited' | 'active';

export function getMemberAccessStatus(input: {
  is_active: boolean;
  must_change_password?: boolean | null;
}): MemberAccessStatus {
  if (!input.is_active) return 'inactive';
  if (input.must_change_password) return 'invited';
  return 'active';
}

export function memberAccessStatusLabel(status: MemberAccessStatus): string {
  switch (status) {
    case 'inactive':
      return 'Inaktiv';
    case 'invited':
      return 'Eingeladen';
    case 'active':
      return 'Aktiv';
    default:
      return status;
  }
}

export function memberAccessStatusBadgeClass(status: MemberAccessStatus): string {
  switch (status) {
    case 'inactive':
      return 'travel';
    case 'invited':
      return 'invited';
    case 'active':
      return 'active';
    default:
      return '';
  }
}
