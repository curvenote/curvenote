import * as React from 'react';
import { cn } from '../../utils/cn.js';
import { Input } from './input.js';
import { SmallErrorTray } from './error.js';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  description?: string;
}

const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ className, label, error, description, id, ...props }, ref) => {
    return (
      <div className={cn('space-y-1', className)}>
        {label && (
          <label htmlFor={id} className="text-sm font-medium">
            {label}
          </label>
        )}
        <Input
          id={id}
          className={cn({ 'border-red-500 focus-visible:ring-red-500': error }, className)}
          ref={ref}
          {...props}
        />
        {error && <SmallErrorTray error={error} />}
        {description && !error && (
          <p className="text-sm text-stone-500 dark:text-stone-400">{description}</p>
        )}
      </div>
    );
  },
);
TextField.displayName = 'TextField';

export { TextField };
