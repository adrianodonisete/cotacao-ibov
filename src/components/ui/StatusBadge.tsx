import type { HTMLAttributes, ReactNode } from 'react';

export type StatusTone = 'success' | 'warning' | 'error' | 'muted';

const TONE: Record<StatusTone, string> = {
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  error: 'bg-error/10 text-error border-error/30',
  muted: 'bg-surface-card text-muted border-hairline',
};

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone: StatusTone;
  children?: ReactNode;
};

export function StatusBadge({ tone, className = '', children, ...rest }: Props) {
  return (
    <span
      className={`inline-flex items-center font-sans font-medium text-caption rounded-pill px-3 py-1 border ${TONE[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
