import { Info } from 'lucide-react';
import { cn, primitives } from '@curvenote/scms-core';
import { LISTING_SEARCH_MIN_LENGTH } from './listingParams.js';

interface SubmissionsSearchHelpProps {
  className?: string;
}

/**
 * Hover-card explaining what the search box matches against and how the
 * Postgres `ILIKE` operator is exposed to the user (the `%` and `_`
 * wildcards). Lives to the right of the search input.
 */
export function SubmissionsSearchHelp({ className }: SubmissionsSearchHelpProps) {
  return (
    <primitives.HoverCardWrapper
      className="z-50 w-80 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-200"
      content={
        <div className="space-y-3">
          <div>
            <p className="font-medium text-foreground">How search works</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Case-insensitive substring match across each submission&rsquo;s versions.
            </p>
          </div>

          <ul className="space-y-1 text-xs">
            <li className="flex gap-2 items-start">
              <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-gray-400" />
              <span>
                Looks at <span className="font-medium">title</span>,{' '}
                <span className="font-medium">authors</span>, and{' '}
                <span className="font-medium">DOI</span>.
              </span>
            </li>
            <li className="flex gap-2 items-start">
              <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-gray-400" />
              <span>
                Matches any version of the submission — a hit on an old version still returns a
                result.
              </span>
            </li>
            <li className="flex gap-2 items-start">
              <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-gray-400" />
              <span>
                Type at least <span className="font-medium">{LISTING_SEARCH_MIN_LENGTH}</span>{' '}
                characters.
              </span>
            </li>
          </ul>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-foreground">Available wildcards</p>
            <ul className="mt-1 space-y-1 text-xs">
              <li className="flex gap-2 items-start">
                <code className="rounded bg-gray-100 px-1 py-px font-mono text-[11px] dark:bg-gray-800">
                  %
                </code>
                <span>matches any sequence of characters, e.g. </span>
                <code className="rounded bg-gray-100 px-1 py-px font-mono text-[11px] dark:bg-gray-800">
                  smith%2024
                </code>
              </li>
              <li className="flex gap-2 items-start">
                <code className="rounded bg-gray-100 px-1 py-px font-mono text-[11px] dark:bg-gray-800">
                  _
                </code>
                <span>matches a single character, e.g. </span>
                <code className="rounded bg-gray-100 px-1 py-px font-mono text-[11px] dark:bg-gray-800">
                  10.1_/journal
                </code>
              </li>
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Without wildcards, the term is wrapped in <code className="font-mono">%term%</code>{' '}
              automatically.
            </p>
          </div>
        </div>
      }
    >
      <button
        type="button"
        aria-label="Search help"
        className={cn(
          'inline-flex justify-center items-center rounded-md size-7 shrink-0 text-muted-foreground hover:bg-stone-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-stone-800',
          className,
        )}
      >
        <Info className="size-4" aria-hidden />
      </button>
    </primitives.HoverCardWrapper>
  );
}
