'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '../../utils/cn.js';
import { Button } from './button.js';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';

export interface ComboBoxOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
}

interface ComboBoxProps {
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
}

export function ComboBox({
  options,
  value,
  onValueChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found.',
  disabled = false,
  triggerClassName,
  contentClassName,
}: ComboBoxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  // Reset search when closing
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearchValue('');
    }
  };

  const selectedOption = options.find((option) => option.value === value);

  // Separate clear option from regular options
  const regularOptions = options.filter((option) => option.value !== '__clear__');
  const hasClearOption = options.some((option) => option.value === '__clear__');
  const shouldShowClear = hasClearOption && value; // Always show clear when there's a value

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', triggerClassName)}
          disabled={disabled}
        >
          <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('p-0 w-full', contentClassName)}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            className="py-1 h-9"
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {/* Sticky clear option - always visible when there's a value */}
            {shouldShowClear && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onValueChange('');
                    setOpen(false);
                  }}
                  className="sticky top-0 z-10 border-b bg-background"
                  data-clear-option="true"
                >
                  <Check className="w-4 h-4 mr-2 opacity-0" />
                  <span className="text-muted-foreground">Clear selection</span>
                </CommandItem>
              </CommandGroup>
            )}

            {/* Filter regular options based on search */}
            {(() => {
              const filteredOptions = searchValue
                ? regularOptions.filter(
                    (option) =>
                      option.label.toLowerCase().includes(searchValue.toLowerCase()) ||
                      (option.description &&
                        option.description.toLowerCase().includes(searchValue.toLowerCase())),
                  )
                : regularOptions;

              if (filteredOptions.length === 0 && searchValue) {
                return <CommandEmpty>{emptyMessage}</CommandEmpty>;
              }

              return (
                <CommandGroup>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      onSelect={(currentValue) => {
                        onValueChange(currentValue === value ? '' : currentValue);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === option.value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        {option.description && (
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })()}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
