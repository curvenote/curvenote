import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon } from 'lucide-react';

import { cn } from '../../utils/cn.js';

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer border-stone-300 dark:border-stone-600 bg-white dark:bg-transparent',
        'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary',
        'data-[state=checked]:border-primary dark:data-[state=checked]:border-primary',
        'focus-visible:border-ring focus-visible:ring-ring/50',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        'size-5 shrink-0 rounded-[4px] border-2 transition-all duration-200',
        'outline-none focus-visible:ring-[3px]',
        'hover:border-stone-400 dark:hover:border-stone-500',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'cursor-pointer',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className={cn(
          'flex items-center justify-center text-current',
          'transition-transform duration-200 ease-in-out',
          'data-[state=checked]:scale-100 data-[state=unchecked]:scale-0',
        )}
      >
        <CheckIcon className="size-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
