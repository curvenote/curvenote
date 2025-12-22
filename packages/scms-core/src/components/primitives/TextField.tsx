import React from 'react';
import type { InputHTMLAttributes } from 'react';
// utils
import { cn } from '../../utils/cn.js';
import { Input } from '../ui/input.js';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  name: string;
  label: string;
  type?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  error?: string | null | undefined;
  status?: string | null | undefined;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    id,
    name,
    type = 'text',
    required = false,
    placeholder,
    className,
    label,
    error,
    status,
    ...rest
  },
  ref,
) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label htmlFor={id} className="block mb-1 text-sm font-medium">
          {label}
          {required && (
            <span title="This field is mandatory" aria-label="required" className="text-red-700">
              *
            </span>
          )}
        </label>
      )}
      <div className={cn('relative', className)}>
        <Input
          ref={ref}
          id={id}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          className={cn(
            'block w-full rounded-lg border px-3 py-2 text-sm text-stone-600 transition-colors duration-200 placeholder:font-light dark:bg-transparent dark:text-white',
            error
              ? 'border-red-700 focus:border-red-700 focus:ring-red-700 dark:border-red-700  dark:focus:border-red-700 dark:focus:ring-red-700'
              : 'border-blue-100 focus:border-theme-blue-900 focus:ring-theme-blue-900 dark:border-blue-100/20  dark:focus:border-theme-blue-900 dark:focus:ring-theme-blue-900',
            className,
          )}
          {...rest}
        />
        {status && !error ? (
          <div
            className="absolute text-xs text-gray-300 dark:text-gray-700 top-1/3 right-4"
            id={id}
          >
            {status}
          </div>
        ) : null}
      </div>
      {error ? (
        <span className="text-xs text-red-700 dark:text-red-700" id={id}>
          {error}
        </span>
      ) : null}
    </div>
  );
});
