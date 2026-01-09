import { useFetcher } from 'react-router';
import { SquarePen } from 'lucide-react';
import { useState } from 'react';
import { ui } from '@curvenote/scms-core';

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

  const date = datePublished ? hyphenatedToDate(datePublished) : undefined;
  const [selectedDate, setSelectedDate] = useState(date);
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <ui.Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
      <ui.PopoverTrigger asChild>
        <div
          className="text-right underline cursor-pointer"
          title={`Publication Date${date ? ` ${datePublished}` : ''}`}
        >
          {datePublished ?? 'n/a'}
          {canUpdate && <SquarePen className="inline-block w-4 h-4 ml-[2px] mb-[2px]" />}
        </div>
      </ui.PopoverTrigger>
      <ui.PopoverContent className="w-auto p-0">
        <ui.Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          initialFocus
        />
        <div className="flex p-2 space-x-2">
          <ui.Button
            className="flex-1"
            variant="outline"
            disabled={fetcher.state !== 'idle'}
            type="reset"
            onClick={() => {
              setSelectedDate(date);
              setCalendarOpen(false);
            }}
          >
            Cancel
          </ui.Button>
          <ui.Button
            className="flex-1"
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
