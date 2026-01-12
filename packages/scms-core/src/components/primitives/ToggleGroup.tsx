import * as React from 'react';
import * as RadixToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from '../../utils/index.js';
import { flushSync } from 'react-dom';

/**
 * Radix-ui ToggleGroup wrapped for styling
 *
 * Note toggle groups are not intended to be used in forms,
 * you probably want a RadioGroup for that
 *
 * @param param0
 * @returns
 */
export function ToggleGroup({
  id,
  label,
  value,
  defaultValue,
  ariaLabel,
  children,
  onChange,
}: React.PropsWithChildren<{
  id: string;
  label?: string;
  value?: string; // if controlled
  defaultValue?: string;
  ariaLabel: string;
  onChange?: (value: string) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
}>) {
  const [localValue, setLocalValue] = React.useState(defaultValue);

  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="block mb-2 text-sm tracking-wide text-stone-800 dark:text-stone-100"
        >
          {label}
        </label>
      )}
      <RadixToggleGroup.Root
        className="inline-flex bg-gray-50 rounded shadow-[0_0_1px] shadow-blackA4 space-x-px divide-x divide-solid divide-gray-200"
        type="single"
        value={value ?? localValue}
        onValueChange={(v: string) => {
          if (v) {
            flushSync(() => setLocalValue(v));
            onChange?.(v);
          }
        }}
        aria-label={ariaLabel}
      >
        {children}
      </RadixToggleGroup.Root>
    </div>
  );
}

export function ToggleItem({
  className,
  value,
  title,
  ariaLabel,
  children,
}: React.PropsWithChildren<{
  className?: string;
  title: string;
  value: string;
  ariaLabel: string;
}>) {
  const classes = cn(
    'flex h-[35px] w-[35px] items-center justify-center',
    'hover:bg-gray-100 color-gray-700 data-[state=on]:bg-gray-200 data-[state=on]:text-black',
    'bg-white text-base leading-4 first:rounded-l last:rounded-r',
    'focus:z-10 focus:shadow-[0_0_0_2px] focus:shadow-black focus:outline-hidden',
    className,
  );

  return (
    <RadixToggleGroup.Item className={classes} value={value} aria-label={ariaLabel} title={title}>
      {children}
    </RadixToggleGroup.Item>
  );
}
