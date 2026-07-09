'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'secondary-on-dark' | 'text-link' | 'icon-circular' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-6 text-[15px]',
};

const VARIANT: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-active active:bg-primary-active disabled:bg-primary-disabled disabled:text-muted disabled:cursor-not-allowed',
  secondary: 'bg-canvas text-ink border border-hairline hover:border-ink active:bg-surface-soft disabled:bg-surface-soft disabled:text-muted disabled:cursor-not-allowed',
  'secondary-on-dark': 'bg-surface-dark-elev text-on-dark border border-transparent hover:border-on-dark-soft active:bg-surface-dark-soft disabled:bg-surface-dark-soft disabled:text-on-dark-soft disabled:cursor-not-allowed',
  'text-link': 'bg-transparent text-ink hover:text-primary active:text-primary-active underline-offset-4 hover:underline px-0 h-auto disabled:text-muted disabled:cursor-not-allowed',
  'icon-circular': 'bg-canvas text-ink border border-hairline hover:border-ink rounded-full p-0 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed',
  danger: 'bg-error text-on-primary hover:opacity-90 active:opacity-80 disabled:bg-primary-disabled disabled:text-muted disabled:cursor-not-allowed',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...rest
}: Props) {
  const sizeClass = variant === 'icon-circular' ? 'h-9 w-9' : SIZE[size];
  const base = 'inline-flex items-center justify-center gap-2 rounded-md font-sans font-medium transition-colors select-none';
  return (
    <button type={type} className={`${base} ${sizeClass} ${VARIANT[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
