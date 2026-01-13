import React from 'react';
import * as RadixRadioGroup from '@radix-ui/react-radio-group';
import { cn } from '../../utils/index.js';

export function RadioGroup(
  props: React.PropsWithChildren<
    RadixRadioGroup.RadioGroupProps & React.RefAttributes<HTMLDivElement>
  >,
) {
  const { children, orientation, ...rest } = props;
  return (
    <RadixRadioGroup.Root
      className={cn('flex gap-2.5', { 'flex-col': orientation === 'vertical' })}
      orientation={orientation}
      {...rest}
    >
      {children}
    </RadixRadioGroup.Root>
  );
}

export function RadioGroupItem(
  props: { label: string } & RadixRadioGroup.RadioGroupItemProps &
    React.RefAttributes<HTMLButtonElement>,
) {
  const { id, value, label, ...rest } = props;
  return (
    <div className="flex items-center">
      <RadixRadioGroup.Item
        className={cn(
          'bg-white w-[25px] h-[25px] rounded-full',
          'shadow-[0_0_1px] shadow-black hover:bg-gray-300 focus:shadow-[0_0_0_2px] focus:shadow-black outline-hidden cursor-default',
        )}
        id={id}
        value={value}
        {...rest}
      >
        <RadixRadioGroup.Indicator
          className={cn(
            'flex items-center justify-center w-full h-full relative',
            "after:content-[''] after:block after:w-[11px] after:h-[11px] after:rounded-[50%] after:bg-sky-600",
          )}
        />
      </RadixRadioGroup.Item>
      <label className="text-black dark:text-white pl-[15px]" htmlFor={id}>
        {label}
      </label>
    </div>
  );
}
