import type { ElementType, HTMLAttributes, ReactNode } from 'react';

type Tone = 'ink' | 'body' | 'body-strong' | 'muted' | 'muted-soft' | 'on-dark' | 'on-dark-soft' | 'primary' | 'error' | 'success';

const TONE: Record<Tone, string> = {
  ink: 'text-ink',
  body: 'text-body',
  'body-strong': 'text-body-strong',
  muted: 'text-muted',
  'muted-soft': 'text-muted-soft',
  'on-dark': 'text-on-dark',
  'on-dark-soft': 'text-on-dark-soft',
  primary: 'text-primary',
  error: 'text-error',
  success: 'text-success',
};

type TypoProps = {
  children: ReactNode;
  className?: string;
  tone?: Tone;
  as?: ElementType;
};

function make(as: ElementType, base: string) {
  return function Component({ children, className, tone = 'ink', as: Tag = as, ...rest }: TypoProps & HTMLAttributes<HTMLElement>) {
    return (
      <Tag className={`${base} ${TONE[tone]} ${className ?? ''}`} {...rest}>
        {children}
      </Tag>
    );
  };
}

export const Display = make('h1', 'font-display text-display-xl');
export const H1 = make('h1', 'font-display text-display-lg');
export const H2 = make('h2', 'font-display text-display-md');
export const H3 = make('h3', 'font-display text-display-sm');
export const TitleLg = make('h3', 'font-sans text-title-lg');
export const TitleMd = make('h4', 'font-sans text-title-md');
export const TitleSm = make('h5', 'font-sans text-title-sm');
export const Lead = make('p', 'font-sans text-title-md text-body-strong');
export const Body = make('p', 'font-sans text-body-md');
export const BodySm = make('p', 'font-sans text-body-sm');
export const Caption = make('span', 'font-sans text-caption');
export const CaptionUpper = make('span', 'font-sans text-caption-uppercase uppercase');
export const Mono = make('span', 'font-mono text-[14px] leading-[1.6]');
