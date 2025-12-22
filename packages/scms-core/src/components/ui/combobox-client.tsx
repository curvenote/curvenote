'use client';

import { ComboBox } from './combobox.js';
import type { ComboBoxOption } from './combobox.js';
import { cn } from '../../utils/cn.js';

export type { ComboBoxOption };

interface ClientComboBoxProps {
  options: ComboBoxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  error?: string;
  onErrorClear?: () => void;
}

export function ClientComboBox({
  options,
  value,
  onValueChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found.',
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  error,
  onErrorClear,
}: ClientComboBoxProps) {
  // Add clear option when there's a value
  const optionsWithClear = value
    ? [
        ...options,
        {
          value: '__clear__',
          label: 'Clear selection',
          description: undefined,
          disabled: false,
        },
      ]
    : options;

  const handleValueChange = (newValue: string) => {
    if (newValue === '__clear__') {
      onValueChange('');
      onErrorClear?.();
    } else {
      onValueChange(newValue);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <ComboBox
        options={optionsWithClear}
        value={value}
        onValueChange={handleValueChange}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
        disabled={disabled}
        triggerClassName={cn(error && 'border-red-500 focus:border-red-500', triggerClassName)}
        contentClassName={contentClassName}
      />

      {/* Error message */}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
