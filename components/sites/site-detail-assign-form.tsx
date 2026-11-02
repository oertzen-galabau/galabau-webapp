import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
  hint?: ReactNode;
};

export function SiteDetailAssignForm({ children, className, actions, hint }: Props) {
  return (
    <div className={['site-detail-assign-form', className].filter(Boolean).join(' ')}>
      {children}
      {actions ? <div className="site-detail-assign-form__actions">{actions}</div> : null}
      {hint ? <div className="site-detail-assign-form__hint muted">{hint}</div> : null}
    </div>
  );
}
