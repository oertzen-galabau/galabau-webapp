import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Check, Pencil, Trash2, X, XCircle } from 'lucide-react';

type IconActionVariant = 'default' | 'brand' | 'danger';

type IconActionButtonProps = {
  label: string;
  variant?: IconActionVariant;
  children: ReactNode;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled' | 'onClick'>;

export function IconActionButton({
  label,
  variant = 'default',
  children,
  type = 'button',
  disabled,
  onClick,
}: IconActionButtonProps) {
  return (
    <button
      type={type}
      className={`table-icon-action table-icon-action--${variant}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function TableIconActions({ children }: { children: ReactNode }) {
  return <div className="inline-actions table-icon-actions">{children}</div>;
}

type PresetProps = Pick<IconActionButtonProps, 'type' | 'disabled' | 'onClick'>;

export function EditIconAction(props: PresetProps) {
  return (
    <IconActionButton label="Bearbeiten" variant="brand" {...props}>
      <Pencil size={18} />
    </IconActionButton>
  );
}

export function CancelEditIconAction(props: PresetProps) {
  return (
    <IconActionButton label="Abbrechen" {...props}>
      <X size={18} />
    </IconActionButton>
  );
}

export function DeleteIconAction(props: PresetProps) {
  return (
    <IconActionButton label="Löschen" variant="danger" {...props}>
      <Trash2 size={18} />
    </IconActionButton>
  );
}

export function ApproveIconAction(props: PresetProps) {
  return (
    <IconActionButton label="Freigeben" variant="brand" {...props}>
      <Check size={18} />
    </IconActionButton>
  );
}

export function RejectIconAction(props: PresetProps) {
  return (
    <IconActionButton label="Ablehnen" variant="danger" {...props}>
      <XCircle size={18} />
    </IconActionButton>
  );
}

export function SaveIconAction(props: PresetProps) {
  return (
    <IconActionButton label="Speichern" variant="brand" {...props}>
      <Check size={18} />
    </IconActionButton>
  );
}
