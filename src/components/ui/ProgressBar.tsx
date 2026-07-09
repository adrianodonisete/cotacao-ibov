type Props = {
  value: number;
  max?: number;
  tone?: 'running' | 'done' | 'error';
  className?: string;
  showLabel?: string;
};

const TONE = {
  running: 'bg-primary',
  done: 'bg-success',
  error: 'bg-error',
};

export function ProgressBar({ value, max = 100, tone = 'running', className = '', showLabel }: Props) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={`w-full bg-hairline rounded-pill h-2 overflow-hidden ${className}`}>
      <div className={`h-2 rounded-pill transition-all duration-500 ${TONE[tone]}`} style={{ width: `${pct}%` }} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={showLabel} />
    </div>
  );
}
