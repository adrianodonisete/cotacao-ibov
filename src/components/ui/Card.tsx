import type { HTMLAttributes, ReactNode } from 'react';

type Variant = 'feature' | 'product-mockup-dark' | 'code-window' | 'callout-coral';

const VARIANT: Record<Variant, string> = {
  'feature': 'bg-surface-card text-ink border border-hairline rounded-lg',
  'product-mockup-dark': 'bg-surface-dark text-on-dark border border-surface-dark-elev rounded-lg',
  'code-window': 'bg-surface-dark text-on-dark border border-surface-dark-elev rounded-lg overflow-hidden',
  'callout-coral': 'bg-primary text-on-primary rounded-lg',
};

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  children?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
};

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
  xl: 'p-8',
};

export function Card({ variant = 'feature', padding, className = '', children, ...rest }: CardProps) {
  const pad = padding ? PADDING[padding] : '';
  return (
    <div className={`${VARIANT[variant]} ${pad} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-8 py-5 border-b border-hairline ${className}`}>
      {children}
    </div>
  );
}

export function CardBody({ className = '', children }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-8 ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-8 py-4 border-t border-hairline ${className}`}>
      {children}
    </div>
  );
}
