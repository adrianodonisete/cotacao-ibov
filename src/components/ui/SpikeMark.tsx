type Props = {
  size?: number;
  className?: string;
  title?: string;
};

export function SpikeMark({ size = 16, className, title = 'Cotação IBOV' }: Props) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      fill="currentColor"
    >
      <title>{title}</title>
      <path d="M8 0 L9.2 6.8 L16 8 L9.2 9.2 L8 16 L6.8 9.2 L0 8 L6.8 6.8 Z" />
    </svg>
  );
}
