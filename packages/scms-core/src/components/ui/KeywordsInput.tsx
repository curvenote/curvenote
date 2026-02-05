import * as React from 'react';

import { cn } from '../../utils/cn.js';

export type KeywordsInputProps = {
  value: string[];
  onValueChange: (value: string[]) => void;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** When true, duplicate entries are rejected. Default true. */
  allowDuplicates?: boolean;
};

/**
 * Input for a list of keywords/tags. Type and press Enter or comma to add;
 * click × on a chip to remove. Blur also adds the current input.
 */
export const KeywordsInput = React.forwardRef<HTMLInputElement, KeywordsInputProps>(
  (
    {
      value,
      onValueChange,
      id,
      placeholder = 'Type and press Enter to add',
      disabled = false,
      className,
      allowDuplicates = false,
    },
    ref,
  ) => {
    const [inputValue, setInputValue] = React.useState('');

    const handleAdd = React.useCallback(
      (toAdd: string) => {
        const trimmed = toAdd.trim();
        if (!trimmed) return;
        if (allowDuplicates === false && value.includes(trimmed)) return;
        onValueChange([...value, trimmed]);
        setInputValue('');
      },
      [value, onValueChange, allowDuplicates],
    );

    const handleRemove = React.useCallback(
      (index: number) => {
        onValueChange(value.filter((_, i) => i !== index));
      },
      [value, onValueChange],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        handleAdd(inputValue);
      }
    };

    return (
      <div
        className={cn(
          'flex flex-wrap gap-2 rounded-md border border-input bg-background px-3 py-2 shadow-xs min-h-9 transition-colors',
          'focus-within:ring-1 focus-within:ring-ring',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        {value.map((keyword, index) => (
          <span
            key={`${keyword}-${index}`}
            className="inline-flex items-center gap-1 rounded-sm border border-transparent bg-primary/10 text-primary px-2 py-0.5 text-sm font-medium"
          >
            {keyword}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="ml-0.5 rounded p-0.5 hover:bg-primary/20 focus:outline-none focus:ring-1 focus:ring-ring"
                aria-label={`Remove ${keyword}`}
              >
                <span className="sr-only">Remove</span>
                <span aria-hidden>×</span>
              </button>
            )}
          </span>
        ))}
        <input
          ref={ref}
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => inputValue.trim() && handleAdd(inputValue)}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[8rem] border-0 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>
    );
  },
);

KeywordsInput.displayName = 'KeywordsInput';
