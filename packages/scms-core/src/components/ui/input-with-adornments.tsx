import * as React from 'react';

import { cn } from '../../utils/cn.js';

interface InputWithAdornmentsProps extends React.ComponentProps<'div'> {
  leadingAdornment?: React.ReactNode;
  trailingAdornment?: React.ReactNode;
}

function InputWithAdornments({
  className,
  children,
  leadingAdornment,
  trailingAdornment,
  ...props
}: InputWithAdornmentsProps) {
  return (
    <div
      data-slot="input-with-adornments"
      className={cn(
        'relative flex items-center rounded-md border border-input bg-background shadow-xs transition-colors',
        'focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring',
        className,
      )}
      {...props}
    >
      {leadingAdornment && (
        <span
          data-slot="input-with-adornments-leading"
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 pointer-events-none"
        >
          {leadingAdornment}
        </span>
      )}
      {children}
      {trailingAdornment && (
        <span
          data-slot="input-with-adornments-trailing"
          className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2"
        >
          {trailingAdornment}
        </span>
      )}
    </div>
  );
}

export { InputWithAdornments };
