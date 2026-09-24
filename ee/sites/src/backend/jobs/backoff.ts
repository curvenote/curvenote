import type { JobDepositRow } from './handler.server.js';

const DELAYS_MINUTES = [1, 2, 5, 10, 30];
/**
 * Wait before poll n. The first ten polls are a minute apart because the user is usually watching
 * the row right after registering, and polling only reads, so a quick result is worth the requests.
 */
const POLL_DELAYS_MINUTES = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 5, 5, 10, 30];
const CAP_MINUTES = 60;

/**
 * Past this long since the attempt started, a Crossref outage is no longer waited out. Exported
 * because the failure copy tells the user how long we waited.
 */
export const HORIZON_HOURS = 72;
const HORIZON_MS = HORIZON_HOURS * 60 * 60 * 1000;

function minutesFromNow(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

/**
 * When attempt number `attempt` (1-based) runs again. Scheduled rows are promoted every minute,
 * so 1 minute is the floor.
 */
export function scheduledAtAfter(now: Date, attempt: number): string {
  return minutesFromNow(now, DELAYS_MINUTES[attempt - 1] ?? CAP_MINUTES);
}

/** When poll number `poll` (1-based) runs, scheduled from the deposit or from the previous poll. */
export function pollScheduledAt(now: Date, poll: number): string {
  return minutesFromNow(now, POLL_DELAYS_MINUTES[poll - 1] ?? CAP_MINUTES);
}

/**
 * Whether the attempt (`DoiDeposit.date_created`) is older than the horizon, so a retryable
 * Crossref answer fails the deposit instead of rescheduling it: an endpoint that keeps answering
 * 5xx would otherwise be retried forever.
 */
export function pastHorizon(row: JobDepositRow, now: Date): boolean {
  return now.getTime() - new Date(row.date_created).getTime() > HORIZON_MS;
}
