import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../utils/cn.js';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-sm text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer',
  {
    variants: {
      size: {
        default: 'h-9 px-4 py-2',
        tiny: 'h-4 rounded-sm px-2 text-xs leading-3 font-base [&_svg]:size-[10px]',
        xs: 'h-6 rounded-sm px-2 text-xs font-base [&_svg]:size-3',
        sm: 'h-8 rounded-sm px-3 text-xs [&_svg]:size-3',
        lg: 'h-10 rounded-sm px-8',
        icon: 'h-10 w-10 rounded-full [&_svg]:size-6 [&_svg]:shrink-0',
        'icon-sm': 'h-8 w-8 rounded-sm [&_svg]:size-4 [&_svg]:shrink-0',
        'icon-xs': 'h-6 w-6 rounded-sm [&_svg]:size-4 [&_svg]:shrink-0',
      },
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'font-normal text-primary underline-offset-4 hover:underline py-0 px-0',
        action:
          'border border-stone-200 bg-white shadow-[0px_1px_2px_0px_rgba(68,64,60,0.24),0px_1px_3px_0px_rgba(68,64,60,0.12)] hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700/50 disabled:hover:bg-white dark:disabled:hover:bg-stone-800',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ size, variant, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
