import { CronExpressionParser } from 'cron-parser';
import type { CronJob } from '@curvenote/scms-db';

/** Compute the next UTC ISO run time after `after` (default: now). Run-once — no backfill. */
export function computeNextRunAt(
  schedule: string,
  timezone: string,
  after: Date = new Date(),
): string {
  const interval = CronExpressionParser.parse(schedule, {
    tz: timezone || 'UTC',
    currentDate: after,
  });
  return interval.next().toDate().toISOString();
}

export function computeInitialNextRunAt(schedule: string, timezone: string): string {
  return computeNextRunAt(schedule, timezone);
}

export type DueCronJobRow = CronJob;
