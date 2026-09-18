import { HardHat } from 'lucide-react';
import { getPlatformName } from '@/lib/tenant/config';

type Props = {
  subtitle?: string;
};

export function AuthBrandHeader({ subtitle }: Props) {
  return (
    <div className="auth-brand">
      <span className="auth-brand-symbol" aria-hidden>
        <HardHat size={22} strokeWidth={2.25} />
      </span>
      <span className="auth-brand-text">
        <strong>{getPlatformName()}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </div>
  );
}
