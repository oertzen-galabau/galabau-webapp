import { Loader2 } from 'lucide-react';

type InlineSpinnerProps = {
  size?: number;
  className?: string;
};

export function InlineSpinner({ size = 16, className }: InlineSpinnerProps) {
  return (
    <Loader2
      size={size}
      className={['inline-spinner spin', className].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  );
}
