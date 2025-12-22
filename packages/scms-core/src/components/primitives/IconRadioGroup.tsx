import React from 'react';
import * as RadixRadioGroup from '@radix-ui/react-radio-group';
import { cn } from '../../utils/index.js';

export function IconRadioGroup({
  id,
  label,
  name,
  value,
  disabled,
  defaultValue,
  onValueChange,
  children,
}: React.PropsWithChildren<{
  id?: string;
  label?: string;
  name: string;
  'aria-label': string;
  value?: string;
  disabled?: boolean;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}>) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block mb-2 text-sm tracking-wide text-stone-800 dark:text-stone-100"
      >
        {label}
      </label>
      <RadixRadioGroup.Root
        className={cn(
          'flex border-[1px] border-gray-200 w-max rounded-md divide-x divide-gray-200',
        )}
        orientation="horizontal"
        name={name}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        {children}
      </RadixRadioGroup.Root>
    </div>
  );
}

export function IconRadioItem({ value, children }: React.PropsWithChildren<{ value: string }>) {
  return (
    <RadixRadioGroup.Item
      className={cn(
        'w-[40px] h-[40px] flex justify-center items-center relative overflow-hidden',
        'hover:bg-gray-100',
        'focus:ring-2 focus:ring-black ring-inset outline-hidden cursor-pointer',
      )}
      value={value}
    >
      <div>
        {children}
        <RadixRadioGroup.Indicator
          className={cn(
            'flex items-center justify-center w-full h-full absolute top-0 left-0 bottom-0 right-0',
            "after:content-[''] after:block after:w-full after:h-full after:opacity-10 after:bg-sky-600",
          )}
        ></RadixRadioGroup.Indicator>
      </div>
    </RadixRadioGroup.Item>
  );
}
