import type { InputHTMLAttributes } from 'react';
import React from 'react';
import { cn } from '../../utils/index.js';

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  name: string;
  label: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { id, name, required = false, className, label, onChange, disabled, ...rest },
  ref,
) {
  return (
    <div className="space-x-2">
      <input
        ref={ref}
        type="checkbox"
        id={id}
        name={name}
        required={required}
        onChange={onChange}
        className={cn(
          'w-5 h-5 bg-theme-blue rounded shadow-xs',
          'hover:cursor-pointer border-slate-400',
          'focus:ring-theme-blue-600 focus:border-theme-blue-600 focus:ring-theme-blue-900/50 focus:ring-offset-0',
          { 'text-gray-400! cursor-not-allowed!': disabled },
          className,
        )}
        disabled={disabled}
        {...rest}
      />
      <label
        htmlFor={id}
        className={cn('mb-2 text-sm tracking-wide hover:cursor-pointer', {
          'text-gray-400! cursor-not-allowed!': disabled,
        })}
      >
        {label}
        {required && (
          <span title="This field is mandatory" aria-label="required" className="">
            *
          </span>
        )}
      </label>
    </div>
  );
});
