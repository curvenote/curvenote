import { useFetcher } from 'react-router';
import { SquarePen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ui } from '@curvenote/scms-core';
import { publicationDateCalendarBounds } from '../../publicationDateCalendar.js';

export function hyphenatedFromDate(date: Date) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function hyphenatedToDate(date: string) {
  if (!date.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)) {
    return new Date(date);
  }
  const year = Number(date.split('-')[0]);
  const month = Number(date.split('-')[1]) - 1;
  const day = Number(date.split('-')[2]);
  return new Date(year, month, day);
}

/** Invalid Date is truthy — never pass it to DayPicker's `month` / `selected`. */
function parsePublicationDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = hyphenatedToDate(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function PublicationDate({
  submissionId,
  datePublished,
  canUpdate,
}: {
  submissionId: string;
  datePublished?: string;
  canUpdate: boolean;
}) {
  const fetcher = useFetcher<{ error?: string }>();

  const committedDate = parsePublicationDate(datePublished);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(committedDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() =>
    startOfMonth(committedDate ?? new Date()),
  );

  // Sync draft state when the popover opens; reset to saved value each time.
  useEffect(() => {
    if (!calendarOpen) return;
    setSelectedDate(parsePublicationDate(datePublished));
    setVisibleMonth(startOfMonth(parsePublicationDate(datePublished) ?? new Date()));
  }, [calendarOpen, datePublished]);

  return (
    <ui.Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
      <ui.PopoverTrigger asChild>
        <div
          className="text-right underline cursor-pointer"
          title={`Publication Date${committedDate ? ` ${datePublished}` : ''}`}
        >
          {datePublished ?? 'n/a'}
          {canUpdate && <SquarePen className="inline-block w-4 h-4 ml-[2px] mb-[2px]" />}
        </div>
      </ui.PopoverTrigger>
      <ui.PopoverContent className="w-auto p-0">
        <ui.Calendar
          mode="single"
          captionLayout="dropdown-buttons"
          {...publicationDateCalendarBounds()}
          selected={selectedDate}
          onSelect={setSelectedDate}
          month={visibleMonth}
          onMonthChange={setVisibleMonth}
          initialFocus
        />
        <div className="flex gap-1.5 px-2 pb-2 pt-1">
          <ui.Button
            className="flex-1"
            size="sm"
            variant="outline"
            disabled={fetcher.state !== 'idle'}
            type="reset"
            onClick={() => {
              setSelectedDate(committedDate);
              setCalendarOpen(false);
            }}
          >
            Cancel
          </ui.Button>
          <ui.Button
            className="flex-1"
            size="sm"
            disabled={!selectedDate || fetcher.state !== 'idle'}
            onClick={() => {
              if (!selectedDate) return;
              setCalendarOpen(false);
              fetcher.submit(
                {
                  submission_id: submissionId,
                  date_published: hyphenatedFromDate(selectedDate),
                  formAction: 'set-date-published',
                },
                { method: 'POST' },
              );
            }}
            type="submit"
          >
            Save
          </ui.Button>
        </div>
      </ui.PopoverContent>
    </ui.Popover>
  );
}
