import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useSearchParams } from 'react-router';
import { CornerDownLeft, Loader2, Search, X } from 'lucide-react';
import { cn } from '@curvenote/scms-core';
import { LISTING_SEARCH_MIN_LENGTH, setListingParam } from './listingParams.js';

interface SubmissionsSearchInputProps {
  className?: string;
}

/** Trimmed value actually written to the URL, or '' when below the min length. */
function toEffective(value: string): string {
  return value.trim().length >= LISTING_SEARCH_MIN_LENGTH ? value.trim() : '';
}

/**
 * URL-bound search box for the submissions listing, dispatched on Enter or blur.
 *
 * `q` in the URL is the source of truth. Local state mirrors it so typing feels
 * responsive, but nothing is pushed to the URL while typing. The search fires
 * when the user presses Enter or leaves the field (blur), which keeps history
 * clean and cuts loader hits to one per intentional query. Blur also commits a
 * cleared box, so deleting the text and clicking away strips `q`. A subtle
 * ↵ Enter affordance appears on the right while the input is "dirty" (differs
 * from the active search).
 *
 * Below `LISTING_SEARCH_MIN_LENGTH` (3) the URL carries no `q` (the route schema
 * enforces the same floor) so the loader takes the fast no-search path.
 */
export function SubmissionsSearchInput({ className }: SubmissionsSearchInputProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const inputId = useId();
  const submitted = searchParams.get('q') ?? '';
  const [value, setValue] = useState(submitted);
  const [isPending, startTransition] = useTransition();
  const lastSyncedRef = useRef(submitted);

  useEffect(() => {
    const urlValue = searchParams.get('q') ?? '';
    if (urlValue !== lastSyncedRef.current) {
      lastSyncedRef.current = urlValue;
      setValue(urlValue);
    }
  }, [searchParams]);

  const pushToUrl = (next: string) => {
    const effective = toEffective(next);
    lastSyncedRef.current = effective;
    startTransition(() => {
      setSearchParams((prev) => setListingParam(prev, 'q', effective || undefined), {
        replace: false,
        preventScrollReset: true,
      });
    });
  };

  const handleClear = () => {
    setValue('');
    pushToUrl('');
  };

  const handleBlur = () => {
    if (toEffective(value) !== lastSyncedRef.current) {
      pushToUrl(value);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      pushToUrl(value);
    } else if (event.key === 'Escape' && value.length > 0) {
      event.preventDefault();
      handleClear();
    }
  };

  const showClear = value.length > 0;
  const isDirty = value.trim() !== submitted && value.trim().length >= LISTING_SEARCH_MIN_LENGTH;

  return (
    <div
      className={cn(
        'relative flex items-center rounded-md bg-stone-100 focus-within:ring-1 focus-within:ring-ring dark:bg-stone-900/60',
        className,
      )}
    >
      <span className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Search className="size-4" aria-hidden />
        )}
      </span>
      <input
        id={inputId}
        type="text"
        role="searchbox"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        maxLength={200}
        placeholder="Search by title, author, or DOI..."
        aria-label="Search submissions"
        autoComplete="off"
        spellCheck={false}
        className={cn(
          'h-9 w-full rounded-md border-0 bg-transparent pl-9 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden',
          showClear ? 'pr-24' : 'pr-3',
        )}
      />
      <div className="absolute right-2 flex items-center gap-1">
        {isDirty ? (
          <span
            className="pointer-events-none hidden items-center gap-1 rounded border border-stone-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex dark:border-stone-700 dark:bg-stone-800"
            aria-hidden
          >
            <CornerDownLeft className="size-3" />
            Enter
          </span>
        ) : null}
        {showClear ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClear}
            aria-label="Clear search"
            className="inline-flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-stone-200 hover:text-foreground dark:hover:bg-stone-800"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
