import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../utils/cn.js';

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-sm border px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        primary: 'border-primary text-primary bg-primary/5 [a&]:hover:bg-primary/10',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
        destructive:
          'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        // Customized for higher contrast: darker borders/text, lighter backgrounds
        outline:
          'border-gray-700 text-gray-800 bg-white dark:border-gray-300 dark:text-gray-200 dark:bg-gray-900 [a&]:hover:bg-gray-50 dark:[a&]:hover:bg-gray-700',
        'outline-muted':
          'border-gray-300 text-gray-600 bg-white dark:border-gray-600 dark:text-gray-400 dark:bg-gray-900 [a&]:hover:bg-gray-50 dark:[a&]:hover:bg-gray-800',
        warning:
          'border-transparent border-warning bg-warning/10 text-foreground [a&]:hover:bg-warning/90 focus-visible:ring-warning/20 dark:focus-visible:ring-warning/40 dark:bg-warning/60',
        success:
          'border-transparent border-success bg-success/10 text-foreground [a&]:hover:bg-success/90 focus-visible:ring-success/20 dark:focus-visible:ring-success/40 dark:bg-success/60',
        'mono-dark':
          'border-transparent bg-black text-white dark:bg-white dark:text-black [a&]:hover:bg-black/90 dark:[a&]:hover:bg-white/90',
        'mono-light':
          'border-transparent bg-white text-black dark:bg-black dark:text-white [a&]:hover:bg-white/90 dark:[a&]:hover:bg-black/90',
      },
      size: {
        xs: 'text-[0.625rem]', // 10px - extra small
        sm: 'text-xs', // 12px - small (default)
        default: 'text-sm', // 14px - default
        lg: 'text-base', // 16px - large
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
);

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

type BadgeSize = VariantProps<typeof badgeVariants>['size'];

export { Badge, badgeVariants, type BadgeSize };
