import type { InputHTMLAttributes } from 'react';
import React from 'react';
// utils
import { cn } from '../../utils/cn.js';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  name: string;
  type?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const TextFieldIcon = React.forwardRef<HTMLInputElement, TextFieldProps>(
  function TextFieldIcon(
    { id, name, type = 'text', placeholder, className, ariaLabel, icon, onChange, ...rest },
    ref,
  ) {
    return (
      <div className="relative w-full h-12 rounded-lg shadow-inner ">
        <div className="absolute inset-y-0 flex items-center pl-2 pointer-events-none">{icon}</div>
        <input
          ref={ref}
          id={id}
          name={name}
          type={type}
          aria-label={ariaLabel}
          placeholder={placeholder}
          onChange={onChange}
          className={cn(
            'block h-12 w-full rounded-lg border border-blue-100 px-3 py-2 pl-7 text-sm text-stone-600 transition-colors duration-200 placeholder:font-light focus:border-theme-blue-900 focus:ring-theme-blue-900 dark:border-blue-100/20 dark:bg-transparent dark:text-white dark:focus:border-theme-blue-900 dark:focus:ring-theme-blue-900',
            className,
          )}
          {...rest}
        />
      </div>
    );
  },
);
