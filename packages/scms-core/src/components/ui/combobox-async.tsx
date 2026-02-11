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

/** 'button' = click button to open popover, then type inside (default). 'inline' = type directly in the box; dropdown appears below with arrow-key select. */
export type AsyncComboBoxTriggerMode = 'button' | 'inline';

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
  /** When 'inline', the control is a single input: type in the box, dropdown appears below, arrow keys to select. When 'button' (default), click to open then type in popover. */
  triggerMode?: AsyncComboBoxTriggerMode;
  /** Optional: called when the search/input string changes (e.g. to support "Add current text" alongside selection). */
  onSearchChange?: (query: string) => void;
  /** When provided, options are driven by the parent (e.g. from a fetcher). Internal onSearch is not called; use for server-side search. */
  externalOptions?: ComboBoxOption[];
  /** When provided with externalOptions, controls loading state (e.g. fetcher.state !== 'idle'). */
  externalLoading?: boolean;
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
  triggerMode = 'button',
  onSearchChange,
  externalOptions,
  externalLoading,
}: AsyncComboBoxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const [options, setOptions] = React.useState<ComboBoxOption[]>(initialOptions);
  const [isLoading, setIsLoading] = React.useState(false);
  const displayOptions = externalOptions !== undefined ? externalOptions : options;
  const displayLoading = externalLoading !== undefined ? externalLoading : isLoading;
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
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setOptions(Array.isArray(results) ? results : []);
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

  // Trigger search when search value changes (skip when parent provides externalOptions)
  React.useEffect(() => {
    if (externalOptions !== undefined) return;
    debouncedSearch(searchValue);
  }, [searchValue, debouncedSearch, externalOptions]);

  // Load selected option details if value is provided
  React.useEffect(() => {
    if (value && !selectedOption) {
      const found = displayOptions.find((option) => option.value === value);
      if (found) {
        setSelectedOption(found);
      }
    }
  }, [value, displayOptions, selectedOption]);

  // Reset state only when value changes from something to nothing (user cleared selection).
  // Do not reset when value is always falsy (e.g. add-author combobox with value=""), so results can render.
  const prevValueRef = React.useRef<string | undefined>(value);
  React.useEffect(() => {
    const hadValue = prevValueRef.current !== undefined && prevValueRef.current !== '';
    const hasNoValue = value === undefined || value === '';
    if (hadValue && hasNoValue) {
      setSearchValue('');
      setSelectedOption(null);
      setSearchError(null);
    }
    prevValueRef.current = value;
  }, [value]);

  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

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
    onSearchChange?.(newValue);
  };

  const focusAfterClose = React.useCallback(() => {
    if (triggerMode === 'inline') {
      inputRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [triggerMode]);

  const handleSelect = (optionValue: string) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    const option = displayOptions.find((opt) => opt.value === optionValue);
    if (option) {
      onValueChange(optionValue);
      // Clear any validation errors when a new option is selected
      setSearchError(null);
      onErrorClear?.();
    }
    setOpen(false);
    setSearchValue('');
    setSearchError(null);
    // When value is empty (e.g. "add another" pattern), keep selection cleared so input shows empty and is ready to type
    const isEmptyValue = value === '' || value === undefined;
    if (isEmptyValue) {
      setSelectedOption(null);
      onSearchChange?.('');
    } else if (option) {
      setSelectedOption(option);
    }
    // Inline + empty value: blur then focus after a tick so cmdk leaves "command" state and the input accepts typing again
    if (isEmptyValue && triggerMode === 'inline') {
      const input = inputRef.current;
      input?.blur();
      setTimeout(() => input?.focus(), 0);
    } else {
      requestAnimationFrame(() => focusAfterClose());
    }
  };

  const clearSelection = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    onValueChange('');
    setSelectedOption(null);
    setSearchError(null);
    onErrorClear?.();
    setOpen(false);
    setSearchValue('');
    requestAnimationFrame(() => focusAfterClose());
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

  const handleInlineFocus = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpen(true);
    setSearchError(null);
    setSearchValue(''); // so user types fresh and placeholder shows
  };

  const handleInlineBlur = () => {
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      setOpen(false);
    }, 200);
  };

  // Inline mode: single input, type in the box, dropdown below with arrow-key select
  if (triggerMode === 'inline') {
    const inlineInputValue = open ? searchValue : displayValue;
    return (
      <div className={cn('relative', className)}>
        <Command
          shouldFilter={false}
          filter={() => 1}
          className={cn(
            'flex flex-col rounded-md border border-input bg-background',
            shouldShowError && 'border-red-500',
            triggerClassName,
          )}
        >
          <CommandInput
            ref={inputRef}
            autoComplete="off"
            placeholder={displayValue ? searchPlaceholder : placeholder}
            value={inlineInputValue}
            onValueChange={(v) => {
              setSearchValue(v);
              setSelectedOption(null);
              setSearchError(null);
              onSearchChange?.(v);
            }}
            onFocus={handleInlineFocus}
            onBlur={handleInlineBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={cn(
              'h-9 rounded-md border-0 bg-transparent focus-visible:ring-2 focus-visible:ring-ring',
              !open && 'cursor-pointer',
            )}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-controls={open ? 'combobox-list-inline' : undefined}
          />
          {open && searchValue.length > 0 && (
            <CommandList
              id="combobox-list-inline"
              role="listbox"
              className={cn(
                'absolute top-full left-0 right-0 z-10 mt-1 max-h-[300px] rounded-md border border-border bg-popover shadow-md',
                contentClassName,
              )}
            >
              {searchValue.length > 0 && searchValue.length < minSearchLength && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Type at least {minSearchLength} characters to search
                </div>
              )}

              {searchValue.length >= minSearchLength && displayLoading && (
                <div className="flex gap-2 items-center px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {loadingMessage}
                </div>
              )}

              {searchError && <div className="px-3 py-2 text-sm text-red-600">{searchError}</div>}

              {searchValue.length >= minSearchLength &&
                !displayLoading &&
                !searchError &&
                displayOptions.length === 0 && (
                  <CommandEmpty>
                    {typeof emptyMessage === 'string' ? emptyMessage : <div>{emptyMessage}</div>}
                  </CommandEmpty>
                )}

              {!displayLoading && !searchError && displayOptions.length > 0 && (
                <CommandGroup>
                  {displayOptions.map((option) => (
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

              {!clearOnEmpty && searchValue.trim() === '' && value && (
                <CommandGroup>
                  <CommandItem value="__clear__" onSelect={() => clearSelection()} role="option">
                    <Check className="mr-2 w-4 h-4 opacity-0" />
                    <span className="text-muted-foreground">Clear selection</span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          )}
        </Command>
        {shouldShowError && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

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
            <ChevronsUpDown className="ml-2 w-4 h-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn('p-0 w-[var(--radix-popover-trigger-width)]', contentClassName)}
          style={{
            width: triggerRef.current?.offsetWidth,
          }}
        >
          <Command shouldFilter={false} filter={() => 1}>
            <CommandInput
              ref={inputRef}
              autoComplete="off"
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

              {searchValue.length >= minSearchLength && displayLoading && (
                <div className="flex gap-2 items-center px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {loadingMessage}
                </div>
              )}

              {searchError && <div className="px-3 py-2 text-sm text-red-600">{searchError}</div>}

              {searchValue.length >= minSearchLength &&
                !displayLoading &&
                !searchError &&
                displayOptions.length === 0 && (
                  <CommandEmpty>
                    {typeof emptyMessage === 'string' ? emptyMessage : <div>{emptyMessage}</div>}
                  </CommandEmpty>
                )}

              {!displayLoading && !searchError && displayOptions.length > 0 && (
                <CommandGroup>
                  {displayOptions.map((option) => (
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
                    <Check className="mr-2 w-4 h-4 opacity-0" />
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
