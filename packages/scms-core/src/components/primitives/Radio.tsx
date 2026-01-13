import type { InputHTMLAttributes } from 'react';
import React from 'react';
import { cn } from '../../utils/cn.js';

interface RadioProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  name: string;
  label: string;
  className?: string;
  required?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string | null;
}
export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { id, name, label, required = false, className, onChange, error, ...rest },
  ref,
) {
  return (
    <div className={cn('space-x-2', className)}>
      <input
        ref={ref}
        type="radio"
        id={id}
        name={name}
        value={label}
        onChange={onChange}
        className={cn(
          'focus:ring-theme-blue-600 h-5 w-5 border-blue-100 bg-transparent text-theme-blue-900 shadow-xs focus:border-theme-blue-700 focus:ring-theme-blue-900/50 focus:ring-offset-0',
          error
            ? 'border-red-700 focus:border-red-700 focus:ring-red-700 dark:border-red-700  dark:focus:border-red-700 dark:focus:ring-red-700'
            : 'border-blue-100 focus:border-theme-blue-900 focus:ring-theme-blue-900 dark:border-blue-100/20  dark:focus:border-theme-blue-900 dark:focus:ring-theme-blue-900',
        )}
        {...rest}
      />
      <label
        htmlFor={id}
        className={cn(
          'mb-2 text-sm tracking-wide ',
          error ? 'text-red-700' : 'text-stone-800 dark:text-stone-100',
        )}
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
    </div>
  );
});
