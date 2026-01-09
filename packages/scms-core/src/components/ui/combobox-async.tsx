'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';

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
import type { ComboBoxOption } from './combobox.js';

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface AsyncComboBoxProps {
  value?: string;
  onValueChange: (value: string) => void;
  onSearch: (query: string) => Promise<ComboBoxOption[]>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string | React.ReactNode;
  loadingMessage?: string;
  minSearchLength?: number;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  error?: string;
  onErrorClear?: () => void;
  clearOnEmptySearch?: boolean;
  initialOptions?: ComboBoxOption[];
}

export function AsyncComboBox({
  value,
  onValueChange,
  onSearch,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found.',
  loadingMessage = 'Loading...',
  minSearchLength = 3,
  disabled = false,
  className,
  triggerClassName,
  contentClassName,
  error,
  onErrorClear,
  clearOnEmptySearch: clearOnEmpty = false,
  initialOptions = [],
}: AsyncComboBoxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [options, setOptions] = React.useState<ComboBoxOption[]>(initialOptions);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [selectedOption, setSelectedOption] = React.useState<ComboBoxOption | null>(() => {
    // Initialize selectedOption if we have a value and initial options
    if (value && initialOptions.length > 0) {
      return initialOptions.find((option) => option.value === value) || null;
    }
    return null;
  });
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounced search function
  const debouncedSearch = React.useCallback(
    debounce(async (query: string) => {
      if (query.length < minSearchLength) {
        setOptions([]);
        setSearchError(null);
        return;
      }

      setIsLoading(true);
      setSearchError(null);

      try {
        const results = await onSearch(query);
        setOptions(results);
      } catch (err) {
        console.error('Search failed:', err);
        setOptions([]);
        setSearchError(err instanceof Error ? err.message : 'Search failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [onSearch, minSearchLength],
  );

  // Trigger search when search value changes
  React.useEffect(() => {
    debouncedSearch(searchValue);
  }, [searchValue, debouncedSearch]);

  // Load selected option details if value is provided
  React.useEffect(() => {
    if (value && !selectedOption) {
      const found = options.find((option) => option.value === value);
      if (found) {
        setSelectedOption(found);
      }
    }
  }, [value, options, selectedOption]);

  // Reset state when value is cleared
  React.useEffect(() => {
    if (!value) {
      setSearchValue('');
      setSelectedOption(null);
      setSearchError(null);
    }
  }, [value]);

  const handleOpen = () => {
    const newOpen = !open;
    setOpen(newOpen);
    setSearchError(null);

    // When opening, focus the input but don't set search value
    if (newOpen) {
      // Focus the input after a brief delay to ensure the popover is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } else {
      setSearchValue('');
    }
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  };

  const handleInputChange = (newValue: string) => {
    setSearchValue(newValue);
    setSelectedOption(null);
    setSearchError(null);

    // Don't automatically clear the value when input is emptied
    // Only clear when user explicitly confirms with Enter/Escape (if clearOnEmpty is true)
  };

  const handleSelect = (optionValue: string) => {
    const option = options.find((opt) => opt.value === optionValue);
    if (option) {
      setSelectedOption(option);
      onValueChange(optionValue);
      // Clear any validation errors when a new option is selected
      setSearchError(null);
      onErrorClear?.();
    }
    setOpen(false);
    setSearchValue('');
    setSearchError(null);
    // Return focus to trigger button
    triggerRef.current?.focus();
  };

  const clearSelection = () => {
    onValueChange('');
    setSelectedOption(null);
    setSearchError(null);
    onErrorClear?.();
    setOpen(false);
    setSearchValue('');
    // Return focus to trigger button
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (clearOnEmpty && (e.key === 'Enter' || e.key === 'Escape')) {
      const trimmedValue = searchValue.trim();
      if (trimmedValue === '') {
        e.preventDefault();
        // Clear the selection when input is empty and user presses Enter or Escape
        clearSelection();
      }
    }
  };

  const displayValue = selectedOption?.label || value || '';

  // Show error if there's a value and an error, but not when the dropdown is open
  const shouldShowError = Boolean(error && displayValue && !open);

  return (
    <div className={cn('relative', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? 'combobox-list' : undefined}
            className={cn(
              'w-full justify-between',
              shouldShowError && 'border-red-500 focus:border-red-500',
              triggerClassName,
            )}
            disabled={disabled}
            onClick={handleOpen}
            onKeyDown={handleTriggerKeyDown}
          >
            <span className={cn('truncate', !displayValue && 'text-muted-foreground')}>
              {displayValue || placeholder}
            </span>
            <ChevronsUpDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn('p-0 w-[var(--radix-popover-trigger-width)]', contentClassName)}
          style={{
            width: triggerRef.current?.offsetWidth,
          }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              ref={inputRef}
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="py-1 h-9"
            />
            <CommandList id="combobox-list" role="listbox">
              {searchValue.length > 0 && searchValue.length < minSearchLength && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Type at least {minSearchLength} characters to search
                </div>
              )}

              {searchValue.length >= minSearchLength && isLoading && (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {loadingMessage}
                </div>
              )}

              {searchError && <div className="px-3 py-2 text-sm text-red-600">{searchError}</div>}

              {searchValue.length >= minSearchLength &&
                !isLoading &&
                !searchError &&
                options.length === 0 && (
                  <CommandEmpty>
                    {typeof emptyMessage === 'string' ? emptyMessage : <div>{emptyMessage}</div>}
                  </CommandEmpty>
                )}

              {!isLoading && !searchError && options.length > 0 && (
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      onSelect={handleSelect}
                      role="option"
                      aria-selected={value === option.value}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === option.value ? 'opacity-100 text-green-600' : 'opacity-0',
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
              )}

              {/* Add clear option when clearOnEmpty is disabled and input is empty */}
              {!clearOnEmpty && searchValue.trim() === '' && value && (
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      clearSelection();
                    }}
                    role="option"
                  >
                    <Check className="w-4 h-4 mr-2 opacity-0" />
                    <span className="text-muted-foreground">Clear selection</span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {shouldShowError && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
