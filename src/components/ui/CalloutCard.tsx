import type { ReactNode } from 'react';

type Props = {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function CalloutCard({ title, description, action, children, className = '' }: Props) {
  return (
    <section className={`bg-primary text-on-primary rounded-lg p-12 flex flex-col gap-6 ${className}`}>
      {(title || description) && (
        <div className="flex flex-col gap-3">
          {title && <h2 className="font-display text-display-sm">{title}</h2>}
          {description && <p className="font-sans text-body-md max-w-2xl opacity-90">{description}</p>}
        </div>
      )}
      {action}
      {children}
    </section>
  );
}
