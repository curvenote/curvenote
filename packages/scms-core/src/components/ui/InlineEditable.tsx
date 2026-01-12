import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFetcher } from 'react-router';
import { Input } from './input.js';
import { Textarea } from './textarea.js';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn.js';

export const InlineEditable = forwardRef(function InlineEditable(
  {
    intent,
    defaultValue = '',
    fetcher: parentFetcher,
    className = '',
    multiline = false,
    placeholder = '',
    textClassName = '',
    ariaLabel,
    renderDisplay,
    size = 'default', // 'default' | 'compact'
    error,
    onChange,
    extraFields = {},
    pattern,
  }: {
    intent: string;
    defaultValue?: string;
    fetcher?: ReturnType<typeof useFetcher>;
    className?: string;
    multiline?: boolean;
    placeholder?: string;
    textClassName?: string;
    ariaLabel?: string;
    renderDisplay?: (value: string) => React.ReactNode;
    size?: 'default' | 'compact';
    error?: string;
    onChange?: (value: string) => void;
    extraFields?: Record<string, string>;
    pattern?: string;
  },
  ref,
) {
  // Use parent fetcher if provided, otherwise create a local one
  const localFetcher = useFetcher<{ success?: boolean; error?: any }>();
  const fetcher = parentFetcher ?? localFetcher;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(defaultValue);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Expose startEdit method to parent via ref
  useImperativeHandle(ref, () => ({
    startEdit: () => setEditing(true),
  }));

  // Optimistic value: use fetcher.formData during submission
  let value = internalValue;
  if (fetcher.state === 'submitting' && fetcher.formData) {
    const optimistic = fetcher.formData.get('value');
    if (typeof optimistic === 'string') value = optimistic;
  }

  // Handle server response and revert optimistic updates on error
  useEffect(() => {
    if (fetcher.data && fetcher.state === 'idle') {
      const data = fetcher.data as any;
      if (data.error) {
        // Revert optimistic update on error
        setInternalValue(value);
        if (onChange) onChange(value);
      }
    }
  }, [fetcher.data, fetcher.state, value, onChange]);

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  function finishEdit() {
    setEditing(false);
    if (draft !== value) {
      // Check if there's a validation error
      if (error) {
        // Revert to previous value and don't submit
        setDraft(value);
        setInternalValue(value);
        if (onChange) onChange(value);
        return;
      }

      // Only submit if validation passes
      const formData = new FormData();
      formData.set('intent', intent);
      formData.set('value', draft.trim());
      // Add extra fields (e.g., slot, path)
      for (const [k, v] of Object.entries(extraFields)) {
        formData.set(k, v);
      }
      fetcher.submit(formData, { method: 'post' });
      setInternalValue(draft.trim());
      if (onChange) onChange(draft.trim());
    }
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!multiline && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      finishEdit();
    }
    if (multiline && e.key === 'Escape') {
      e.preventDefault();
      finishEdit();
    }
  }

  const inputSizeClass = size === 'compact' ? 'h-7 text-xs px-2 py-1' : '';
  const errorClass = error ? 'border-red-500' : '';
  const displaySizeClass = size === 'compact' ? 'h-7 text-xs' : 'h-9 px-3 py-1';

  // Helper function to filter input based on pattern
  function filterInput(inputValue: string): string {
    if (!pattern) return inputValue;
    // For the label pattern, only allow letters, numbers, spaces, dots, commas, ampersands, parentheses, hyphens, and underscores
    return inputValue
      .split('')
      .filter((char) => /^[a-zA-Z0-9 .,&()_-]$/.test(char))
      .join('');
  }

  return editing ? (
    <fetcher.Form
      method="post"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        finishEdit();
      }}
    >
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="prevValue" value={value} />
      {Object.entries(extraFields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {multiline ? (
        <Textarea
          ref={inputRef as any}
          className={cn(`w-full resize-none ${className}`, inputSizeClass, errorClass)}
          value={draft}
          onChange={(e) => {
            const filteredValue = filterInput(e.target.value);
            setDraft(filteredValue);
            if (onChange) onChange(filteredValue);
          }}
          onBlur={finishEdit}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          rows={3}
          placeholder={placeholder}
        />
      ) : (
        <Input
          ref={inputRef as any}
          className={cn(`w-full ${className}`, inputSizeClass, errorClass)}
          value={draft}
          pattern={pattern}
          onChange={(e) => {
            const filteredValue = filterInput(e.target.value);
            setDraft(filteredValue);
            if (onChange) onChange(filteredValue);
          }}
          onBlur={finishEdit}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          placeholder={placeholder}
        />
      )}
      {error && <div className="mt-1 text-xs text-red-500">{error}</div>}
      {fetcher.state === 'submitting' && (
        <Loader2 className="inline w-4 h-4 ml-2 align-middle animate-spin text-muted-foreground" />
      )}
    </fetcher.Form>
  ) : (
    <span
      data-name="inline-editable"
      className={cn(`flex relative items-center cursor-pointer ${textClassName}`, displaySizeClass)}
      tabIndex={0}
      onClick={startEdit}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && startEdit()}
      aria-label={ariaLabel}
      role="button"
    >
      {renderDisplay
        ? renderDisplay(value)
        : value || <span className="text-stone-400">{placeholder}</span>}
      {fetcher.state === 'submitting' && (
        <Loader2 className="inline w-4 h-4 ml-2 align-middle animate-spin text-muted-foreground" />
      )}
    </span>
  );
});
