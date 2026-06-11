import { z } from 'zod';

export const INBOX_QUEUE_SORTS = ['name', 'count', 'maxAge'] as const;
export type InboxQueueSort = (typeof INBOX_QUEUE_SORTS)[number];
export const INBOX_QUEUE_SORT_DEFAULT: InboxQueueSort = 'count';

export const INBOX_QUEUE_SORT_LABELS: Record<InboxQueueSort, string> = {
  name: 'Alphabetical',
  count: 'Highest count',
  maxAge: 'Slowest queue',
};

const InboxQueueSortSchema = z.enum(INBOX_QUEUE_SORTS).catch(INBOX_QUEUE_SORT_DEFAULT);

export function parseInboxQueueSort(value: string | null | undefined): InboxQueueSort {
  return InboxQueueSortSchema.parse(value ?? INBOX_QUEUE_SORT_DEFAULT);
}

/** Queue tiles visible before "Show all" — multiplied by the responsive column count. */
export const INBOX_QUEUE_COLLAPSED_ROWS = 3;
