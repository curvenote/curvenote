import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Calendar as CalendarIcon, ChevronDown, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { cn, ui } from '@curvenote/scms-core';
import {
  LISTING_DATE_PRESETS,
  computeDatePresetRange,
  matchPresetForRange,
  setListingParam,
  type ListingDatePresetId,
} from './listingParams.js';

interface SubmissionsDateFilterProps {
  className?: string;
}

/**
 * Published-date filter chip. Encodes a range selection as
 * `?from=YYYY-MM-DD&to=YYYY-MM-DD` so a "Past week" link sent today still
 * shows the same window when opened tomorrow (server resolves presets to
 * concrete dates at click time).
 *
 * The popover offers range presets (Anytime, Today, Past week/month/year,
 * Custom range) plus a dedicated "No Published Date" option below a divider
 * that flips the listing into `?unpublishedOnly=1` mode — submissions whose
 * `date_published` is NULL. Range and unpublished modes are mutually
 * exclusive: switching one on clears the other.
 */
export function SubmissionsDateFilter({ className }: SubmissionsDateFilterProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;
  const unpublishedOnly = searchParams.get('unpublishedOnly') === '1';
  const [open, setOpen] = useState(false);

  const activePreset = matchPresetForRange(from, to, unpublishedOnly);
  const hasSelection = Boolean(from || to || unpublishedOnly);

  /**
   * Writes a coherent date-mode state in one go. Range and `unpublishedOnly`
   * are mutually exclusive — passing `next.unpublishedOnly === true` always
   * clears `from` / `to`, and any non-empty range clears `unpublishedOnly`.
   */
  const applyDateMode = (next: { from?: string; to?: string; unpublishedOnly?: boolean }) => {
    const wantUnpublished = next.unpublishedOnly === true;
    setSearchParams(
      (prev) => {
        let updated = setListingParam(prev, 'from', wantUnpublished ? undefined : next.from);
        updated = setListingParam(updated, 'to', wantUnpublished ? undefined : next.to);
        updated = setListingParam(updated, 'unpublishedOnly', wantUnpublished ? '1' : undefined);
        return updated;
      },
      { replace: false, preventScrollReset: true },
    );
  };

  const handlePresetClick = (preset: ListingDatePresetId) => {
    if (preset === 'anytime') {
      applyDateMode({});
      setOpen(false);
      return;
    }
    if (preset === 'custom') {
      // Don't close; let the user pick on the calendar.
      return;
    }
    if (preset === 'no_published_date') {
      applyDateMode({ unpublishedOnly: true });
      setOpen(false);
      return;
    }
    const range = computeDatePresetRange(preset);
    applyDateMode(range);
    setOpen(false);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (!range || (!range.from && !range.to)) {
      applyDateMode({});
      return;
    }
    applyDateMode({
      from: range.from ? dateToIso(range.from) : undefined,
      to: range.to ? dateToIso(range.to) : range.from ? dateToIso(range.from) : undefined,
    });
  };

  const handleClear = () => {
    applyDateMode({});
  };

  const triggerLabel = formatTriggerLabel(activePreset, from, to);

  // The calendar pane is only meaningful in range mode — hide it when the
  // user has picked "No Published Date" so the popover doesn't suggest a
  // range is in play.
  const showCalendar = activePreset !== 'no_published_date';
  const calendarSelected: DateRange | undefined = from
    ? { from: isoToDate(from), to: to ? isoToDate(to) : undefined }
    : undefined;

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
          aria-label={`Published: ${triggerLabel}`}
        >
          <CalendarIcon className="size-3.5" aria-hidden />
          <span>
            Published: <span className="font-medium">{triggerLabel}</span>
          </span>
          {hasSelection ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear published-date filter"
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
      <ui.PopoverContent align="start" className="p-0 w-auto">
        <div className="flex flex-col sm:flex-row">
          <div className="flex shrink-0 flex-col gap-0.5 border-b border-border p-2 sm:w-44 sm:border-r sm:border-b-0">
            {LISTING_DATE_PRESETS.map((preset) => {
              const isActive = preset.id === activePreset;
              // Visually separate the range presets from the "No Published
              // Date" option so users read it as a distinct mode rather
              // than another preset on the same scale.
              const isSpecialMode = preset.id === 'no_published_date';
              return (
                <Fragment key={preset.id}>
                  {isSpecialMode ? (
                    <div className="my-1 border-t border-border" aria-hidden />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handlePresetClick(preset.id)}
                    className={cn(
                      'rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    {preset.label}
                  </button>
                </Fragment>
              );
            })}
          </div>
          {showCalendar ? (
            <ui.Calendar
              mode="range"
              selected={calendarSelected}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              defaultMonth={calendarSelected?.from}
            />
          ) : (
            <div className="flex items-center px-4 py-6 max-w-xs text-xs text-muted-foreground">
              Showing submissions that have no{' '}
              <span className="mx-1 font-medium">date_published</span> set. Switch back to a range
              preset or pick on the calendar to filter by a window.
            </div>
          )}
        </div>
      </ui.PopoverContent>
    </ui.Popover>
  );
}

/* ---------- formatting helpers ---------- */

function formatTriggerLabel(
  preset: ListingDatePresetId,
  from: string | undefined,
  to: string | undefined,
): string {
  if (preset === 'anytime') return 'Anytime';
  if (preset === 'today') return 'Today';
  if (preset === 'past_week') return 'Past week';
  if (preset === 'past_month') return 'Past month';
  if (preset === 'past_year') return 'Past year';
  // Compact form of the menu label ("No Published Date") so the chip stays
  // tight — the chip already prefixes with "Published:" giving us
  // "Published: None set", which reads cleanly.
  if (preset === 'no_published_date') return 'None set';
  if (from && to && from === to) return formatShortDate(from);
  if (from && to) return `${formatShortDate(from)} – ${formatShortDate(to)}`;
  if (from) return `From ${formatShortDate(from)}`;
  if (to) return `Until ${formatShortDate(to)}`;
  return 'Anytime';
}

function formatShortDate(iso: string): string {
  // ISO date string (yyyy-mm-dd). Build a local-time Date so the formatter
  // doesn't shift across timezones.
  const date = isoToDate(iso);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}

function isoToDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
