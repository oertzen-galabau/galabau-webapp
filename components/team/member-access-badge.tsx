import {
  getMemberAccessStatus,
  memberAccessStatusBadgeClass,
  memberAccessStatusLabel,
} from '@/lib/team/member-access-status';

type Props = {
  is_active: boolean;
  must_change_password?: boolean | null;
};

export function MemberAccessBadge({ is_active, must_change_password }: Props) {
  const status = getMemberAccessStatus({ is_active, must_change_password });
  return (
    <span className={`status-badge ${memberAccessStatusBadgeClass(status)}`}>
      {memberAccessStatusLabel(status)}
    </span>
  );
}
