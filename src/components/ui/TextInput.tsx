'use client';

import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Size = 'sm' | 'md';

type Common = {
  label?: string;
  hint?: string;
  error?: string;
  inputSize?: Size;
};

const FIELD =
  'block w-full rounded-md bg-canvas text-ink placeholder-muted-soft font-sans text-body-md border border-hairline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition';

const SIZE_INPUT: Record<Size, string> = {
  sm: 'h-8 px-3 py-1 text-body-sm',
  md: 'h-10 px-3.5 py-2 text-body-md',
};

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & Common;
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & Common;

export function TextInput({ label, hint, error, inputSize = 'md', className = '', id, ...rest }: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-caption-uppercase uppercase text-muted font-medium mb-1.5">
          {label}
        </label>
      )}
      <input id={inputId} className={`${FIELD} ${SIZE_INPUT[inputSize]} ${error ? 'border-error focus:border-error focus:ring-error/20' : ''} ${className}`} {...rest} />
      {hint && !error && <p className="mt-1 text-body-sm text-muted-soft">{hint}</p>}
      {error && <p className="mt-1 text-body-sm text-error">{error}</p>}
    </div>
  );
}

export function Textarea({ label, hint, error, className = '', id, rows = 4, ...rest }: TextareaProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-caption-uppercase uppercase text-muted font-medium mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={`${FIELD} px-3.5 py-2.5 font-mono text-body-sm resize-y ${error ? 'border-error focus:border-error focus:ring-error/20' : ''} ${className}`}
        {...rest}
      />
      {hint && !error && <p className="mt-1 text-body-sm text-muted-soft">{hint}</p>}
      {error && <p className="mt-1 text-body-sm text-error">{error}</p>}
    </div>
  );
}
