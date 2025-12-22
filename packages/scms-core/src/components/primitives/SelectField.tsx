import type { InputHTMLAttributes } from 'react';
import React from 'react';
// utils
import { cn } from '../../utils/cn.js';

interface SelectFieldProps extends InputHTMLAttributes<HTMLSelectElement> {
  id: string;
  name: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  options: Record<string, any>[];
}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(function TextField(
  { id, name, required = false, options, className, label, ...rest },
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

      <select
        ref={ref}
        id={id}
        name={name}
        required={required}
        className={cn(
          'h-12 w-full rounded-lg border border-blue-100 px-3 py-2 text-sm text-stone-600 transition-colors duration-200 placeholder:font-light focus:border-theme-blue-900 focus:ring-theme-blue-900 dark:border-gray-50/10 dark:bg-transparent dark:text-white dark:focus:ring-theme-blue-900', // "text-teal-800 focus:border-theme-blue-4000 focus:ring-theme-blue-4000 dark:border-teal-3000/20 dark:bg-teal-3000/10 block w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 placeholder-gray-400 focus:bg-white focus:outline-hidden dark:text-stone-300 sm:text-sm",
          className,
        )}
        {...rest}
      >
        {options?.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
});
