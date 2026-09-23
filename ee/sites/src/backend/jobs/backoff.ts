import type { JobDepositRow } from './handler.server.js';

const DELAYS_MINUTES = [1, 2, 5, 10, 30];
const CAP_MINUTES = 60;

/** Past this long since the attempt started, a Crossref outage is no longer waited out. */
const HORIZON_MS = 72 * 60 * 60 * 1000;

/**
 * When attempt number `attempt` (1-based) runs again. Scheduled rows are promoted every minute,
 * so 1 minute is the floor.
 */
export function scheduledAtAfter(now: Date, attempt: number): string {
  const minutes = DELAYS_MINUTES[attempt - 1] ?? CAP_MINUTES;
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

/**
 * Whether the attempt (`DoiDeposit.date_created`) is older than the horizon, so a retryable
 * Crossref answer fails the deposit instead of rescheduling it: an endpoint that keeps answering
 * 5xx would otherwise be retried forever.
 */
export function pastHorizon(row: JobDepositRow, now: Date): boolean {
  return now.getTime() - new Date(row.date_created).getTime() > HORIZON_MS;
}
