'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { InlineSpinner } from '@/components/ui/inline-spinner';

type PendingButtonProps = {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
  showSpinner?: boolean;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled' | 'onClick' | 'className' | 'form' | 'name' | 'value'>;

function PendingButton({
  pending,
  pendingLabel,
  children,
  showSpinner = true,
  className,
  disabled,
  type = 'button',
  ...rest
}: PendingButtonProps) {
  return (
    <button
      type={type}
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
      {...rest}
    >
      {pending && showSpinner ? <InlineSpinner /> : null}
      {pending ? pendingLabel : children}
    </button>
  );
}

export function PrimaryPendingButton({
  className,
  ...props
}: Omit<PendingButtonProps, 'className'> & { className?: string }) {
  return (
    <PendingButton
      {...props}
      className={['primary-button', className].filter(Boolean).join(' ')}
    />
  );
}

export function SecondaryPendingButton({
  className,
  ...props
}: Omit<PendingButtonProps, 'className'> & { className?: string }) {
  return (
    <PendingButton
      {...props}
      className={['secondary-button', className].filter(Boolean).join(' ')}
    />
  );
}

export function PrimaryPendingButtonCompact({
  className,
  ...props
}: Omit<PendingButtonProps, 'className'> & { className?: string }) {
  return (
    <PrimaryPendingButton
      {...props}
      className={['primary-button--compact', className].filter(Boolean).join(' ')}
    />
  );
}
