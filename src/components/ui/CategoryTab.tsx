'use client';

type Option = { value: string; label: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
};

const SIZE = {
  sm: 'text-caption px-2.5 py-1.5',
  md: 'text-body-sm px-3.5 py-2',
};

export function CategoryTab({ options, value, onChange, size = 'md', className = '' }: Props) {
  return (
    <div className={`inline-flex flex-wrap gap-1 ${className}`} role="tablist">
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-md font-sans font-medium transition-colors ${
              active
                ? 'bg-surface-card text-ink border border-hairline'
                : 'bg-transparent text-muted hover:text-ink hover:bg-surface-soft border border-transparent'
            } ${SIZE[size]}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
