import type { InputHTMLAttributes } from 'react';
import React from 'react';
import { cn } from '../../utils/cn.js';

interface TextAreaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  className?: string;
  defaultValue?: string;
  required?: boolean;
  rows?: number;
  error?: string | null | undefined;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  {
    id,
    name,
    rows = 4,
    placeholder,
    required = false,
    defaultValue,
    className,
    label,
    error,
    ...rest
  },
  ref,
) {
  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="block mb-2 text-sm tracking-wide text-stone-800 dark:text-stone-100"
        >
          {label}
          {required && (
            <span
              title="This field is mandatory"
              aria-label="required"
              className="text-theme-blue-900"
            >
              *
            </span>
          )}
        </label>
      )}

      <textarea
        ref={ref}
        id={id}
        rows={rows}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={cn(
          'w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-stone-600 transition-colors duration-200 placeholder:font-light focus:border-theme-blue-900 focus:ring-theme-blue-900 dark:border-blue-100/20 dark:bg-transparent dark:text-white dark:focus:ring-theme-blue-900',
          error
            ? 'border-red-700 focus:border-red-700 focus:ring-red-700 dark:border-red-700  dark:focus:border-red-700 dark:focus:ring-red-700'
            : 'border-blue-100 focus:border-theme-blue-900 focus:ring-theme-blue-900 dark:border-blue-100/20  dark:focus:border-theme-blue-900 dark:focus:ring-theme-blue-900',
          className,
        )}
        {...rest}
      />
      {error ? (
        <span className="text-xs text-red-700 dark:text-red-700" id={id}>
          {error}
        </span>
      ) : null}
    </div>
  );
});
