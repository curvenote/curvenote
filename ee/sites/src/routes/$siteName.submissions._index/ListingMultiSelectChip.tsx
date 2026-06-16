import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn, ui } from '@curvenote/scms-core';
import {
  readListingCsvParam,
  setListingCsvParam,
  toggleListingCsvParam,
  type ListingParamKey,
} from './listingParams.js';

export interface ListingMultiSelectOption {
  id: string;
  name: string;
}

interface ListingMultiSelectChipProps {
  paramKey: ListingParamKey;
  /** Short label shown in the chip ("Kind", "Collection", ...). */
  label: string;
  /**
   * Whether to render the type-to-filter input inside the popover.
   *
   * Defaults to `true`. Pass `false` for small, closed taxonomies (e.g. the
   * five-status filter) where a search box adds friction without payoff.
   */
  searchable?: boolean;
  /** Search placeholder shown inside the popover (only when `searchable`). */
  searchPlaceholder?: string;
  /** Empty-state copy when no options match the search query (only when `searchable`). */
  noResultsLabel?: string;
  /**
   * Value shown when nothing is selected (e.g. `"All"`). When set, the trigger
   * reads `{label}: {defaultValueLabel}` and an option to clear is offered.
   */
  defaultValueLabel?: string;
  options: ListingMultiSelectOption[];
  className?: string;
}

/**
 * Reusable Popover + Command multi-select chip backed by a CSV URL param.
 *
 * Shared by SubmissionsKindFilter, SubmissionsCollectionFilter, and
 * SubmissionsStatusFilter. Adding a new multi-select chip is a one-liner:
 * pick a `paramKey`, pass the options, and decide whether the popover needs
 * a search input (`searchable` — default true).
 */
export function ListingMultiSelectChip({
  paramKey,
  label,
  searchable = true,
  searchPlaceholder = 'Search...',
  noResultsLabel = 'No matches.',
  defaultValueLabel,
  options,
  className,
}: ListingMultiSelectChipProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = readListingCsvParam(searchParams, paramKey);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const [open, setOpen] = useState(false);

  const handleToggle = (id: string) => {
    setSearchParams((prev) => toggleListingCsvParam(prev, paramKey, id), {
      replace: false,
      preventScrollReset: true,
    });
  };

  const handleClear = () => {
    setSearchParams((prev) => setListingCsvParam(prev, paramKey, []), {
      replace: false,
      preventScrollReset: true,
    });
  };

  const summary = formatSelectionSummary(label, options, selected, defaultValueLabel);
  const hasSelection = selected.length > 0;
  const ariaLabel =
    summary.kind === 'label-only' ? summary.text : `${summary.prefix}: ${summary.value}`;

  return (
    <ui.Popover open={open} onOpenChange={setOpen}>
      <ui.PopoverTrigger asChild>
        <ui.Button
          variant="action"
          size="sm"
          className={cn(
            'gap-1.5 whitespace-nowrap font-normal',
            hasSelection &&
              'border-primary/40 bg-primary/5 dark:border-primary/40 dark:bg-primary/10',
            className,
          )}
          aria-label={ariaLabel}
        >
          {summary.kind === 'label-only' ? (
            <span>{summary.text}</span>
          ) : (
            <span>
              {summary.prefix}: <span className="font-medium">{summary.value}</span>
            </span>
          )}
          {hasSelection ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${label.toLowerCase()} filter`}
              className="-mr-1 ml-0.5 inline-flex size-4 items-center justify-center rounded-sm hover:bg-stone-200 dark:hover:bg-stone-700"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleClear();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  handleClear();
                }
              }}
            >
              <X className="size-3" />
            </span>
          ) : (
            <ChevronDown className="size-3.5 opacity-60" />
          )}
        </ui.Button>
      </ui.PopoverTrigger>
      <ui.PopoverContent align="start" className="w-64 p-0">
        <ui.Command>
          {searchable ? <ui.CommandInput placeholder={searchPlaceholder} boxed /> : null}
          <ui.CommandList>
            {searchable ? <ui.CommandEmpty>{noResultsLabel}</ui.CommandEmpty> : null}
            <ui.CommandGroup>
              {defaultValueLabel ? (
                <ui.CommandItem value={`${defaultValueLabel} all`} onSelect={handleClear}>
                  <Check
                    className={cn(
                      'size-3.5 shrink-0',
                      selected.length === 0 ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">{defaultValueLabel}</span>
                </ui.CommandItem>
              ) : null}
              {options.map((option) => {
                const isSelected = selectedSet.has(option.id);
                return (
                  <ui.CommandItem
                    key={option.id}
                    value={`${option.name} ${option.id}`}
                    onSelect={() => handleToggle(option.id)}
                  >
                    <Check
                      className={cn('size-3.5 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
                      aria-hidden
                    />
                    <span className="flex-1 truncate">{option.name}</span>
                  </ui.CommandItem>
                );
              })}
            </ui.CommandGroup>
          </ui.CommandList>
        </ui.Command>
      </ui.PopoverContent>
    </ui.Popover>
  );
}

function formatSelectionSummary(
  label: string,
  options: ListingMultiSelectOption[],
  selectedIds: readonly string[],
  defaultValueLabel?: string,
): { kind: 'label-only'; text: string } | { kind: 'label-value'; prefix: string; value: string } {
  if (selectedIds.length === 0) {
    if (defaultValueLabel) {
      return { kind: 'label-value', prefix: label, value: defaultValueLabel };
    }
    return { kind: 'label-only', text: label };
  }
  if (selectedIds.length === 1) {
    const match = options.find((option) => option.id === selectedIds[0]);
    return {
      kind: 'label-value',
      prefix: label,
      value: match ? match.name : '1',
    };
  }
  return { kind: 'label-value', prefix: label, value: String(selectedIds.length) };
}
