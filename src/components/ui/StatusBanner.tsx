import type { HTMLAttributes, ReactNode } from 'react';

export type BannerTone = 'error' | 'success' | 'warning' | 'info';

const TONE: Record<BannerTone, string> = {
  error: 'bg-error/5 border-error/30 text-error',
  success: 'bg-success/5 border-success/30 text-success',
  warning: 'bg-warning/5 border-warning/30 text-warning',
  info: 'bg-surface-card border-hairline text-body',
};

type Props = HTMLAttributes<HTMLDivElement> & {
  tone: BannerTone;
  children?: ReactNode;
};

export function StatusBanner({ tone, className = '', children, ...rest }: Props) {
  return (
    <div role="status" className={`rounded-md border px-4 py-3 text-body-sm font-sans ${TONE[tone]} ${className}`} {...rest}>
      {children}
    </div>
  );
}
