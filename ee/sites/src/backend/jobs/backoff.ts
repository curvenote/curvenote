import type { JobDepositRow } from './handler.server.js';

const DELAYS_MINUTES = [1, 2, 5, 10, 30];
const CAP_MINUTES = 60;

/**
 * Minutes to wait before poll (or re-deposit) number `attempt` (1-based). Scheduled rows are
 * promoted every minute, so 1 is the floor.
 */
export function pollDelayMinutes(attempt: number): number {
  return DELAYS_MINUTES[attempt - 1] ?? CAP_MINUTES;
}

export function scheduledAtAfter(now: Date, attempt: number): string {
  return new Date(now.getTime() + pollDelayMinutes(attempt) * 60_000).toISOString();
}

/** A deposit without a result after this long is failed with a clear error. */
export const POLL_HORIZON_MS = 72 * 60 * 60 * 1000;

/** Shared by CROSSREF_DEPOSIT and CROSSREF_POLL: past this long since the attempt started
 * (`DoiDeposit.date_created`), a retryable Crossref answer stops being rescheduled and fails
 * the deposit instead, so a permanently-erroring endpoint doesn't reschedule forever. */
export function pastHorizon(row: JobDepositRow, now: Date): boolean {
  return now.getTime() - new Date(row.date_created).getTime() > POLL_HORIZON_MS;
}
