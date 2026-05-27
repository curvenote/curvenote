import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useSearchParams } from 'react-router';
import { Loader2, Search, X } from 'lucide-react';
import { cn, ui } from '@curvenote/scms-core';
import { LISTING_SEARCH_MIN_LENGTH, setListingParam } from './listingParams.js';

const SEARCH_DEBOUNCE_MS = 500;

interface SubmissionsSearchInputProps {
  className?: string;
}

/**
 * URL-bound debounced search box for the submissions listing.
 *
 * `q` in the URL is the source of truth. Local state mirrors it so the input
 * feels responsive while the navigation that updates `?q=` happens in a
 * transition (kept out of the typing thread).
 *
 * `?q=` is only pushed once the trimmed input reaches `LISTING_SEARCH_MIN_LENGTH`
 * (3) — anything shorter is treated as no search and the URL has the param
 * stripped, so the loader takes the fast (no-join) path. The input still shows
 * whatever the user has typed; only the URL/search side is gated.
 *
 * Page is reset by `setListingParam` whenever the search changes — the user
 * is always taken back to page 1 on a new search.
 */
export function SubmissionsSearchInput({ className }: SubmissionsSearchInputProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const inputId = useId();
  const initialValue = searchParams.get('q') ?? '';
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedRef = useRef(initialValue);

  // Resync local state when the URL changes from outside (e.g. "Clear
  // filters" action, browser back/forward). Avoid clobbering an in-flight
  // edit the user has typed but not yet flushed.
  useEffect(() => {
    const urlValue = searchParams.get('q') ?? '';
    if (urlValue !== lastPushedRef.current) {
      lastPushedRef.current = urlValue;
      setValue(urlValue);
    }
  }, [searchParams]);

  // Cleanup any pending debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const pushToUrl = (next: string) => {
    // Below the trigram-friendly minimum the URL carries no `q` — the route
    // schema enforces the same rule, but doing it here keeps `?q=` out of
    // shareable links until the search is actually meaningful.
    const effective = next.trim().length >= LISTING_SEARCH_MIN_LENGTH ? next : '';
    lastPushedRef.current = effective;
    startTransition(() => {
      setSearchParams(
        (prev) => setListingParam(prev, 'q', effective.length ? effective : undefined),
        {
          replace: true,
          preventScrollReset: true,
        },
      );
    });
  };

  const scheduleDebouncedPush = (next: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushToUrl(next);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setValue(next);
    scheduleDebouncedPush(next);
  };

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue('');
    pushToUrl('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && value.length > 0) {
      event.preventDefault();
      handleClear();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pushToUrl(value);
    }
  };

  const showClear = value.length > 0;

  return (
    <ui.InputWithAdornments
      className={cn(
        'border-0 bg-stone-100 shadow-none focus-within:ring-1 dark:bg-stone-900/60',
        className,
      )}
      leadingAdornment={
        isPending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search className="size-4 text-muted-foreground" aria-hidden />
        )
      }
      trailingAdornment={
        showClear ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="mr-1 inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-stone-200 hover:text-foreground dark:hover:bg-stone-800"
          >
            <X className="size-3.5" />
          </button>
        ) : null
      }
    >
      <ui.Input
        id={inputId}
        // `type="text"` (not `type="search"`) so the browser doesn't render its
        // own native clear `×` button alongside the custom one in
        // `trailingAdornment`. Functionally equivalent for our purposes.
        type="text"
        role="searchbox"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength={200}
        placeholder="Search submissions..."
        aria-label="Search submissions"
        autoComplete="off"
        spellCheck={false}
        className={cn(
          'h-9 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0 dark:bg-transparent',
          showClear && 'pr-9',
        )}
      />
    </ui.InputWithAdornments>
  );
}
