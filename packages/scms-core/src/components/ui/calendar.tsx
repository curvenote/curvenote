import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import type { ClassNames } from 'react-day-picker';

import { cn } from '../../utils/cn.js';
import { buttonVariants } from './button.js';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/** Shared shell for each month/year `<select>` (invisible select over a text label). */
const dropdownFieldShell = 'relative inline-flex h-7 items-center';

const dropdownCaptionLabel = cn(
  'relative z-[1] inline-flex h-7 w-auto items-center gap-1 px-1 text-sm',
  'pointer-events-none select-none',
);

/** Month nav chevrons: no persistent focus ring after mouse use. */
const navButtonClass = cn(
  buttonVariants({ variant: 'outline' }),
  'h-7 w-7 bg-transparent p-0 opacity-80 hover:opacity-100',
  'outline-none focus:outline-none focus-visible:ring-0 focus-visible:outline-none',
);

/**
 * react-day-picker v8 dropdown captions: native `<select>` overlays a faux label.
 * These classNames mirror the library layout but use our input/button tokens.
 */
function dropdownCaptionClassNames(multiMonth: boolean): Partial<ClassNames> {
  return {
    caption: cn('relative mb-2 block min-h-8 px-9 text-center', multiMonth && 'pt-0.5'),
    caption_dropdowns: 'relative inline-flex items-center justify-center gap-1.5',
    dropdown_month: dropdownFieldShell,
    dropdown_year: dropdownFieldShell,
    caption_label: dropdownCaptionLabel,
    dropdown:
      'absolute inset-0 z-[2] h-full w-full cursor-pointer appearance-none border-0 bg-transparent opacity-0',
    dropdown_icon: 'size-3.5 shrink-0 opacity-50',
    vhidden: 'sr-only',
    nav: 'inline-flex items-center whitespace-nowrap',
    nav_button: navButtonClass,
    nav_button_previous: 'absolute top-1/2 left-0 z-[3] -translate-y-1/2',
    nav_button_next: 'absolute top-1/2 right-0 z-[3] -translate-y-1/2',
    caption_start: multiMonth ? 'relative' : undefined,
    caption_end: multiMonth ? 'relative' : undefined,
  };
}

function defaultCaptionClassNames(): Partial<ClassNames> {
  return {
    caption: 'relative flex items-center justify-center pt-1',
    caption_label: 'text-sm font-medium',
    nav: 'flex items-center space-x-1',
    nav_button: cn(navButtonClass, 'opacity-50 hover:opacity-100'),
    nav_button_previous: 'absolute left-1',
    nav_button_next: 'absolute right-1',
  };
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout,
  numberOfMonths,
  components: componentsProp,
  ...props
}: CalendarProps) {
  const captionUsesDropdown =
    captionLayout === 'dropdown' || captionLayout === 'dropdown-buttons';
  const multiMonth = (numberOfMonths ?? 1) > 1;

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      {...(captionLayout != null ? { captionLayout } : {})}
      {...(numberOfMonths != null ? { numberOfMonths } : {})}
      className={cn('p-3', className)}
      classNames={{
        root: cn('m-0', multiMonth && 'rdp-multiple_months'),
        months: 'flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4',
        month: 'space-y-4',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell: 'w-8 rounded-md text-[0.8rem] font-normal text-muted-foreground',
        row: 'mt-2 flex w-full',
        cell: cn(
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md',
          props.mode === 'range'
            ? '[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md'
            : '[&:has([aria-selected])]:rounded-md',
        ),
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-8 w-8 p-0 font-normal aria-selected:opacity-100',
        ),
        day_range_start: 'day-range-start',
        day_range_end: 'day-range-end',
        day_selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_today: 'bg-accent text-accent-foreground',
        day_outside:
          'day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground',
        day_disabled: 'text-muted-foreground opacity-50',
        day_range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        day_hidden: 'invisible',
        ...(captionUsesDropdown ? dropdownCaptionClassNames(multiMonth) : defaultCaptionClassNames()),
        ...classNames,
      }}
      components={{
        IconLeft: ({ className: chevronClassName, ...chevronProps }) => (
          <ChevronLeft className={cn('h-4 w-4', chevronClassName)} {...chevronProps} />
        ),
        IconRight: ({ className: chevronClassName, ...chevronProps }) => (
          <ChevronRight className={cn('h-4 w-4', chevronClassName)} {...chevronProps} />
        ),
        ...(captionUsesDropdown
          ? {
              IconDropdown: ({ className: iconClassName, ...iconProps }) => (
                <ChevronDown className={cn('size-3.5 shrink-0 opacity-50', iconClassName)} {...iconProps} />
              ),
            }
          : {}),
        ...componentsProp,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
