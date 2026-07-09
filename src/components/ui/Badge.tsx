import type { HTMLAttributes, ReactNode } from 'react';

type Variant = 'pill' | 'coral';

const VARIANT: Record<Variant, string> = {
  pill: 'bg-surface-card text-ink border border-hairline',
  coral: 'bg-primary text-on-primary uppercase tracking-[1.5px]',
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  children?: ReactNode;
};

export function Badge({ variant = 'pill', className = '', children, ...rest }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-sans font-medium text-caption rounded-pill px-3 py-1 ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
