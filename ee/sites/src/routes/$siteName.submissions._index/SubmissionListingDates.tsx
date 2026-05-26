import type { ReactNode } from 'react';
import { Calendar, Clock, Send } from 'lucide-react';
import { formatDate, formatDatetime, formatToNow } from '@curvenote/scms-core';

function DateMetaSeparator() {
  return (
    <span className="hidden text-gray-300 sm:inline dark:text-gray-600" aria-hidden>
      |
    </span>
  );
}

function DateMetaItem({
  icon,
  label,
  value,
  title,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <span className="inline-flex gap-1 items-center min-w-0" title={title}>
      <span className="text-gray-400 shrink-0 dark:text-gray-500">{icon}</span>
      <span className="whitespace-nowrap">
        {label} {value}
      </span>
    </span>
  );
}

export function SubmissionListingDates({
  datePublished,
  dateFirstSubmitted,
  dateLastUpdated,
}: {
  datePublished?: string;
  dateFirstSubmitted: string;
  dateLastUpdated: string;
}) {
  return (
    <div className="flex flex-col gap-1 mt-2 text-xs font-light text-gray-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-1 dark:text-gray-400">
      <DateMetaItem
        icon={<Calendar className="size-3.5" aria-hidden />}
        label="Publication Date:"
        value={datePublished ? formatDate(datePublished) : 'n/a'}
      />
      <DateMetaSeparator />
      <DateMetaItem
        icon={<Send className="size-3.5" aria-hidden />}
        label="First Submitted:"
        value={formatDate(dateFirstSubmitted)}
        title={formatDatetime(dateFirstSubmitted)}
      />
      <DateMetaSeparator />
      <DateMetaItem
        icon={<Clock className="size-3.5" aria-hidden />}
        label="Last Updated:"
        value={formatToNow(dateLastUpdated, { addSuffix: true })}
        title={formatDatetime(dateLastUpdated)}
      />
    </div>
  );
}
