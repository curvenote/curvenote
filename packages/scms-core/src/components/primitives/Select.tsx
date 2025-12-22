import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import * as RadixSelect from '@radix-ui/react-select';
import type { ForwardedRef } from 'react';
import React from 'react';
import { cn } from '../../utils/index.js';

export { Group as SelectGroup, Label as SelectLabel } from '@radix-ui/react-dropdown-menu';

interface SelectItemProps extends React.ComponentPropsWithoutRef<typeof RadixSelect.Item> {
  children: React.ReactNode;
  className?: string;
}

export const SelectSeparator = () => {
  return <RadixSelect.Separator className="h-[1px] bg-stone-600 m-[5px]" />;
};

export const SelectItem = React.forwardRef(
  (
    { children, className, ...props }: SelectItemProps,
    forwardedRef: ForwardedRef<HTMLDivElement>,
  ) => {
    return (
      <RadixSelect.Item
        className={cn(
          'leading-none rounded-[3px] flex items-center h-[30px] pr-[35px] pl-[25px] relative select-none',
          'text-gray-800',
          'data-disabled:text-gray-400 data-disabled:pointer-events-none',
          'data-highlighted:outline-hidden data-highlighted:bg-gray-600 data-highlighted:text-gray-200',
          className,
        )}
        {...props}
        ref={forwardedRef}
      >
        <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
        <RadixSelect.ItemIndicator className="absolute left-0 w-[25px] inline-flex items-center justify-center">
          <Check className="w-3 h-3" />
        </RadixSelect.ItemIndicator>
      </RadixSelect.Item>
    );
  },
);

SelectItem.displayName = 'SelectItem';

export function Select({
  placeholder,
  ariaLabel,
  triggerClassName = 'bg-white text-stone-800 focus:shadow-black data-placeholder:text-stone-800 hover:bg-skyblue-300',
  colorClassName = 'bg-white text-black',
  children,
  onValueChange,
  defaultValue,
}: React.PropsWithChildren<{
  placeholder?: string;
  ariaLabel?: string;
  triggerClassName?: string;
  colorClassName?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
}>) {
  return (
    <RadixSelect.Root onValueChange={onValueChange} defaultValue={defaultValue}>
      <RadixSelect.Trigger
        className={cn(
          'inline-flex items-center justify-center rounded px-[15px]',
          'leading-none h-[35px] gap-[5px]',
          'border border-gray-300',
          'shadow-black/10 hover:shadow-[0_0_1px] focus:shadow-[0_0_0_2px] outline-hidden',
          triggerClassName,
        )}
        aria-label={ariaLabel}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="stroke-[1.5px]" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          className={cn(
            'overflow-hidden rounded-md shadow-[0px_10px_38px_-10px_rgba(22,_23,_24,_0.35),0px_10px_20px_-15px_rgba(22,_23,_24,_0.2)]',
            colorClassName,
          )}
        >
          <RadixSelect.ScrollUpButton
            className={cn(
              'flex items-center justify-center h-[25px] cursor-default',
              colorClassName,
            )}
          >
            <ChevronUp className="stroke-[1.5px]" />
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="p-[5px]">{children}</RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton
            className={cn(
              'flex items-center justify-center h-[25px] cursor-default',
              colorClassName,
            )}
          >
            <ChevronDown className="stroke-[1.5px]" />
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
