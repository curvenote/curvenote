import * as React from 'react';
import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '../../utils/cn.js';

export const Menu = RadixMenu.Root;
export const MenuTrigger = RadixMenu.Trigger;

export const MenuContent = React.forwardRef<
  React.ElementRef<typeof RadixMenu.Content>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Content>
>(({ className, ...props }, ref) => (
  <RadixMenu.Portal>
    <RadixMenu.Content
      ref={ref}
      className={cn(
        'p-1 w-40 bg-white rounded-md border shadow-lg dark:bg-stone-800 text-stone-700 dark:text-stone-200 border-stone-200 dark:border-stone-700',
        className,
      )}
      {...props}
    />
  </RadixMenu.Portal>
));
MenuContent.displayName = 'MenuContent';

export const MenuItem = React.forwardRef<
  React.ElementRef<typeof RadixMenu.Item>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Item>
>(({ className, ...props }, ref) => (
  <RadixMenu.Item
    ref={ref}
    className={cn(
      'px-4 py-2 text-sm font-normal rounded transition-colors cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800 focus:bg-stone-100 dark:focus:bg-stone-800 active:bg-stone-200 dark:active:bg-stone-700',
      className,
    )}
    {...props}
  />
));
MenuItem.displayName = 'MenuItem';

export const MenuSeparator = React.forwardRef<
  React.ElementRef<typeof RadixMenu.Separator>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Separator>
>(({ className, ...props }, ref) => (
  <RadixMenu.Separator
    ref={ref}
    className={cn('my-1 h-px bg-stone-200 dark:bg-stone-700', className)}
    {...props}
  />
));
MenuSeparator.displayName = 'MenuSeparator';

export const MenuLabel = React.forwardRef<
  React.ElementRef<typeof RadixMenu.Label>,
  React.ComponentPropsWithoutRef<typeof RadixMenu.Label>
>(({ className, ...props }, ref) => (
  <RadixMenu.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 text-sm font-semibold text-stone-900 dark:text-stone-100',
      className,
    )}
    {...props}
  />
));
MenuLabel.displayName = 'MenuLabel';
