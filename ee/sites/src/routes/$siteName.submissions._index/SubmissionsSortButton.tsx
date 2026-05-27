import { useSearchParams } from 'react-router';
import { ArrowDownWideNarrow, Check, ChevronDown } from 'lucide-react';
import { cn, ui } from '@curvenote/scms-core';
import {
  LISTING_SORTS,
  LISTING_SORTS_AWAITING_DENORMALISATION,
  LISTING_SORT_DEFAULT,
  LISTING_SORT_LABEL,
  setListingParam,
  type ListingSort,
} from './listingParams.js';

interface SubmissionsSortButtonProps {
  className?: string;
}

/**
 * Dropdown that drives the `sort` URL param. Sorts that depend on
 * denormalised Submission columns (the next slice) are rendered as disabled
 * MenuItems with an inline "Coming soon" hint, so the surface is discoverable
 * before the backing data is wired up.
 */
export function SubmissionsSortButton({ className }: SubmissionsSortButtonProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const current = readSort(searchParams);

  const handleSelect = (sort: ListingSort) => {
    setSearchParams(
      (prev) => setListingParam(prev, 'sort', sort === LISTING_SORT_DEFAULT ? undefined : sort),
      { replace: false, preventScrollReset: true },
    );
  };

  return (
    <ui.Menu>
      <ui.MenuTrigger asChild>
        <ui.Button
          variant="action"
          size="sm"
          className={cn('gap-1.5 whitespace-nowrap font-normal', className)}
          aria-label={`Sort by: ${LISTING_SORT_LABEL[current]}`}
        >
          <ArrowDownWideNarrow className="size-3.5" />
          <span>
            Sort: <span className="font-medium">{LISTING_SORT_LABEL[current]}</span>
          </span>
          <ChevronDown className="size-3.5 opacity-60" />
        </ui.Button>
      </ui.MenuTrigger>
      <ui.MenuContent align="end" className="w-64">
        <ui.MenuLabel>Sort by</ui.MenuLabel>
        <ui.MenuSeparator />
        {LISTING_SORTS.map((sort) => {
          const disabled = LISTING_SORTS_AWAITING_DENORMALISATION.has(sort);
          const isSelected = sort === current;
          return (
            <ui.MenuItem
              key={sort}
              disabled={disabled}
              onSelect={() => {
                if (!disabled) handleSelect(sort);
              }}
              className={cn('flex items-center gap-2', disabled && 'data-[disabled]:opacity-60')}
              title={disabled ? 'Available in the next release' : undefined}
            >
              <Check
                className={cn('size-3.5 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
                aria-hidden
              />
              <span className="flex-1">{LISTING_SORT_LABEL[sort]}</span>
              {disabled ? <span className="text-xs text-muted-foreground">Soon</span> : null}
            </ui.MenuItem>
          );
        })}
      </ui.MenuContent>
    </ui.Menu>
  );
}

function readSort(searchParams: URLSearchParams): ListingSort {
  const raw = searchParams.get('sort');
  if (!raw) return LISTING_SORT_DEFAULT;
  // Mirror server-side schema coercion: disabled sorts surface as the default
  // in the toolbar even if a hand-edited URL set one.
  if ((LISTING_SORTS as readonly string[]).includes(raw)) {
    const cast = raw as ListingSort;
    return LISTING_SORTS_AWAITING_DENORMALISATION.has(cast) ? LISTING_SORT_DEFAULT : cast;
  }
  return LISTING_SORT_DEFAULT;
}
