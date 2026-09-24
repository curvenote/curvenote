import { z } from 'zod';

/** Headline stat window options for the inbox dashboard. */
export const INBOX_PERIODS = ['24h', '7d', '30d'] as const;
export type InboxPeriod = (typeof INBOX_PERIODS)[number];
export const INBOX_PERIOD_DEFAULT: InboxPeriod = '7d';

export const INBOX_PERIOD_LABELS: Record<InboxPeriod, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

const InboxPeriodSchema = z.enum(INBOX_PERIODS).catch(INBOX_PERIOD_DEFAULT);

export function parseInboxPeriod(value: string | null | undefined): InboxPeriod {
  return InboxPeriodSchema.parse(value ?? INBOX_PERIOD_DEFAULT);
}

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

export function inboxPeriodDurationMs(period: InboxPeriod): number {
  switch (period) {
    case '24h':
      return MS_HOUR * 24;
    case '7d':
      return MS_DAY * 7;
    case '30d':
      return MS_DAY * 30;
  }
}

/** ISO timestamp for the start of the rolling window (exclusive lower bound uses `>=`). */
export function inboxPeriodStartIso(period: InboxPeriod, now = new Date()): string {
  return new Date(now.getTime() - inboxPeriodDurationMs(period)).toISOString();
}

export const INBOX_ACTIVITY_INITIAL = 5;
export const INBOX_ACTIVITY_PAGE_SIZE = 10;
