import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useSearchParams } from 'react-router';
import { Loader2, Search, X } from 'lucide-react';
import { cn, ui } from '@curvenote/scms-core';

/**
 * Throttle interval for the client-side filter. Short enough that the list
 * visibly refreshes while the user is still typing, long enough that we don't
 * thrash the URL update on every keystroke.
 */
const SEARCH_THROTTLE_MS = 200;

export const SITES_SEARCH_PARAM = 'q';

export const SITES_SEARCH_MIN_LENGTH = 1;

export function readSitesSearchQuery(searchParams: URLSearchParams): string {
  return searchParams.get(SITES_SEARCH_PARAM) ?? '';
}

export function setSitesSearchQuery(
  searchParams: URLSearchParams,
  query: string | undefined,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (query === undefined || query === '') {
    next.delete(SITES_SEARCH_PARAM);
  } else {
    next.set(SITES_SEARCH_PARAM, query);
  }
  return next;
}

interface SitesSearchInputProps {
  /** Number of sites currently visible after filtering. */
  sitesShownCount: number;
  className?: string;
}

/**
 * URL-bound, throttled search box for the My Sites grid.
 *
 * Filtering is purely client-side — the loader never reads `?q=` — but the URL
 * is the source of truth so back/forward and remounts stay in sync with the
 * input. Updates use `replace: true` so typing does not push history entries.
 *
 * Local state mirrors the input. A leading-and-trailing throttle (200ms) writes
 * the effective query to `?q=` inside a transition. The trailing × clears in
 * one click; Esc clears via the keyboard; Enter flushes immediately.
 */
export function SitesSearchInput({ sitesShownCount, className }: SitesSearchInputProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const inputId = useId();
  const initialValue = readSitesSearchQuery(searchParams);
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const lastPushedRef = useRef(initialValue);

  // Throttle bookkeeping. `lastFireAtRef` is the timestamp of the last actual
  // flush; `trailingTimerRef` is the scheduled trailing fire (if any);
  // `pendingValueRef` is the most-recent value waiting to be flushed on the
  // trailing edge. Refs (not state) so updating them never triggers a
  // re-render of the input itself.
  const lastFireAtRef = useRef(0);
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<string | null>(null);

  // Resync local state when the URL changes from outside (browser back/forward,
  // clear button on a stale mount). Avoid clobbering an in-flight edit.
  useEffect(() => {
    const urlValue = readSitesSearchQuery(searchParams);
    if (urlValue !== lastPushedRef.current) {
      lastPushedRef.current = urlValue;
      setValue(urlValue);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current);
    };
  }, []);

  const cancelTrailing = () => {
    if (trailingTimerRef.current) {
      clearTimeout(trailingTimerRef.current);
      trailingTimerRef.current = null;
    }
    pendingValueRef.current = null;
  };

  const pushToUrl = (next: string) => {
    const trimmed = next.trim();
    const effective = trimmed.length >= SITES_SEARCH_MIN_LENGTH ? trimmed : '';
    lastPushedRef.current = effective;
    startTransition(() => {
      setSearchParams((prev) => setSitesSearchQuery(prev, effective || undefined), {
        replace: true,
        preventScrollReset: true,
      });
    });
  };

  const flushQuery = (next: string) => {
    lastFireAtRef.current = Date.now();
    pushToUrl(next);
  };

  const scheduleThrottledFlush = (next: string) => {
    const now = Date.now();
    const elapsed = now - lastFireAtRef.current;

    if (elapsed >= SEARCH_THROTTLE_MS) {
      cancelTrailing();
      flushQuery(next);
      return;
    }

    // Inside the cooldown window — remember the latest value and schedule a
    // single trailing fire for when the window closes. Subsequent keystrokes
    // just update the pending value; they don't queue new timers.
    pendingValueRef.current = next;
    if (trailingTimerRef.current) return;
    trailingTimerRef.current = setTimeout(() => {
      trailingTimerRef.current = null;
      const pendingValue = pendingValueRef.current;
      pendingValueRef.current = null;
      if (pendingValue !== null) {
        flushQuery(pendingValue);
      }
    }, SEARCH_THROTTLE_MS - elapsed);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setValue(next);
    scheduleThrottledFlush(next);
  };

  const handleClear = () => {
    cancelTrailing();
    setValue('');
    flushQuery('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && value.length > 0) {
      event.preventDefault();
      handleClear();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      cancelTrailing();
      flushQuery(value);
    }
  };

  const showClear = value.length > 0;
  const sitesShownLabel =
    sitesShownCount === 1 ? '1 site shown' : `${sitesShownCount.toLocaleString()} sites shown`;

  return (
    <div
      className={cn(
        'p-3 max-w-lg bg-white rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900',
        className,
      )}
    >
      <ui.InputWithAdornments
        className="border-0 shadow-none bg-stone-100 focus-within:ring-1 dark:bg-stone-900/60"
        leadingAdornment={
          isPending ? (
            <Loader2 className="animate-spin size-4 text-muted-foreground" aria-hidden />
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
              className="inline-flex justify-center items-center mr-1 rounded-sm size-6 text-muted-foreground hover:bg-stone-200 hover:text-foreground dark:hover:bg-stone-800"
            >
              <X className="size-3.5" />
            </button>
          ) : null
        }
      >
        <ui.Input
          id={inputId}
          type="text"
          role="searchbox"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={200}
          placeholder="Filter by name, title or url...."
          aria-label="Filter sites by name, title or url"
          autoComplete="off"
          spellCheck={false}
          className={cn(
            'h-9 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0 dark:bg-transparent',
            showClear && 'pr-9',
          )}
        />
      </ui.InputWithAdornments>
      <p className="mt-1 text-xs text-right text-muted-foreground">{sitesShownLabel}</p>
    </div>
  );
}
