import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE = {
  sm: 'py-12',
  md: 'py-16',
  lg: 'py-24',
};

export function HeroBand({ children, className = '', size = 'md' }: Props) {
  return (
    <section className={`bg-canvas w-full ${SIZE[size]} ${className}`}>
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {children}
      </div>
    </section>
  );
}
