import { DOI_DEPOSIT_STATUS, KnownJobTypes, SITE_DOI_CONFIG_STATUS } from '@curvenote/scms-core';
import type { Context, CreateJob } from '@curvenote/scms-core';
import { getPrismaClient } from '@curvenote/scms-server';
import { CrossrefError, crossrefCredentialsFromConfig } from '../crossref/client.server.js';
import { deposit } from '../crossref/deposit.server.js';
import { readPrivateXml } from '../deposit/storage.server.js';
import type { DoiDeps } from '../doi/types.js';
import { failDeposit } from '../registration/result.server.js';
import { pastHorizon, scheduledAtAfter } from './backoff.js';
import { complete, fail, loadDeposit, parsePayload } from './handler.server.js';
import type { CrossrefJobPayload, JobDepositRow } from './handler.server.js';
import { insertJobRow } from './schedule.server.js';
import { loadJobSite } from './site.server.js';

const NO_DEPOSIT = 'no_deposit_after_72h';

/**
 * Crossref could not answer (5xx, maintenance, 429 rate limit) or did not answer (timeout): a
 * transient outage, not a reason to give up on the deposit. Try again later, same attempt. A
 * throw here would be redelivered by pgmq and eventually FAILED instead of rescheduled, so these
 * never throw — they reschedule instead.
 */
function isRetryable(error: CrossrefError) {
  return error.status === undefined || error.status === 429 || error.status >= 500;
}

/** PENDING -> QUEUED; false when another delivery already moved the attempt on. */
async function markQueued(prisma: DoiDeps['prisma'], row: JobDepositRow): Promise<boolean> {
  const { count } = await prisma.doiDeposit.updateMany({
    where: { id: row.id, status: DOI_DEPOSIT_STATUS.PENDING },
    data: { status: DOI_DEPOSIT_STATUS.QUEUED, date_modified: new Date().toISOString() },
  });
  return count === 1;
}

/**
 * Enqueues the next attempt with a backoff delay. The PENDING-gated update runs first, and the
 * SCHEDULED CROSSREF_DEPOSIT job is only inserted once it matches. Inserting the job first would
 * leave a SCHEDULED row that `promoteScheduledJobs` later promotes and runs as a wasted no-op even
 * when the attempt was no longer PENDING — and the "rescheduled" completion message would then be
 * false.
 */
async function rescheduleDeposit(
  prisma: DoiDeps['prisma'],
  row: JobDepositRow,
  payload: CrossrefJobPayload,
): Promise<{ scheduledAt: string; requeued: boolean }> {
  const scheduledAt = scheduledAtAfter(new Date(), payload.attempt);
  const requeued = await prisma.$transaction(async (tx) => {
    const updated = await tx.doiDeposit.updateMany({
      where: { id: row.id, status: DOI_DEPOSIT_STATUS.PENDING },
      data: { date_modified: new Date().toISOString() },
    });
    if (updated.count === 0) {
      return false;
    }
    const job = await insertJobRow(tx, {
      jobType: KnownJobTypes.CROSSREF_DEPOSIT,
      payload: { ...payload, attempt: payload.attempt + 1 },
      scheduledAt,
    });
    await tx.doiDeposit.update({ where: { id: row.id }, data: { job_id: job.jobId } });
    return true;
  });
  return { scheduledAt, requeued };
}

/**
 * Posts one attempt's XML and settles it on Crossref's answer. A failure is the job's doing, not
 * the Register click's, so its activity goes to the platform service account; the user who
 * started the registration may also be gone by the time the job runs. Never throws for a Crossref
 * answer: see `isRetryable`. A non-`CrossrefError` throw (storage, database, a bug) is left to
 * `crossrefDepositHandler`, which fails the attempt before rethrowing.
 */
async function postDeposit(
  ctx: Context,
  prisma: DoiDeps['prisma'],
  row: JobDepositRow,
  payload: CrossrefJobPayload,
  jobId: string,
) {
  const creds = crossrefCredentialsFromConfig(ctx.$config);
  const userId = ctx.$config.api.submissionsServiceAccount.id;
  const site = await loadJobSite(prisma, payload.siteId);
  if (!site || site.status !== SITE_DOI_CONFIG_STATUS.ACTIVE) {
    await failDeposit(prisma, { deposit: row, error: 'site_not_active', userId });
    return complete(jobId, `deposit ${row.id}: site is not ACTIVE, attempt failed`);
  }
  const role = site.role ?? creds.role;
  const xml = await readPrivateXml(ctx, row.xml_path);
  try {
    const answer = await deposit(creds, { role, fileName: row.file_name, xml });
    if (answer.state === 'unauthorized') {
      await failDeposit(prisma, { deposit: row, error: 'site_credentials_rejected', userId });
      return complete(jobId, `deposit ${row.id}: unauthorized, attempt failed`);
    }
    if (!(await markQueued(prisma, row))) {
      return complete(
        jobId,
        `deposit ${row.id}: received by Crossref, but already advanced by another delivery`,
      );
    }
    return complete(jobId, `deposit ${row.id}: received by Crossref, QUEUED`);
  } catch (error) {
    if (!(error instanceof CrossrefError)) {
      throw error;
    }
    if (!isRetryable(error)) {
      // e.g. a 200 without SUCCESS in the body: Crossref answered, but not with a deposit.
      await failDeposit(prisma, { deposit: row, error: error.message, userId });
      return complete(jobId, `deposit ${row.id}: ${error.message}; attempt failed`);
    }
    if (pastHorizon(row, new Date())) {
      // A retryable error (5xx/429/timeout) that never resolved within the horizon: without this,
      // an endpoint that keeps answering 5xx/429 would reschedule hourly forever.
      await failDeposit(prisma, { deposit: row, error: NO_DEPOSIT, userId });
      return complete(jobId, `deposit ${row.id}: ${NO_DEPOSIT}`);
    }
    const { scheduledAt, requeued } = await rescheduleDeposit(prisma, row, payload);
    if (!requeued) {
      return complete(
        jobId,
        `deposit ${row.id}: ${error.message}; already advanced by another delivery, not rescheduled`,
      );
    }
    return complete(jobId, `deposit ${row.id}: ${error.message}; rescheduled for ${scheduledAt}`);
  }
}

/** Posts one attempt's XML. Never throws for a Crossref answer; see `isRetryable`. */
export async function crossrefDepositHandler(ctx: Context, data: CreateJob) {
  const payload = parsePayload(data.payload);
  const prisma = await getPrismaClient();
  const row = await loadDeposit(prisma, payload.depositId);
  if (!row) {
    return fail(data.id, `Deposit ${payload.depositId} not found`);
  }
  if (row.status !== DOI_DEPOSIT_STATUS.PENDING) {
    return complete(data.id, `no-op: deposit ${row.id} is ${row.status}`);
  }
  try {
    return await postDeposit(ctx, prisma, row, payload, data.id);
  } catch (error) {
    // Not a Crossref answer (storage, database, a bug). The runner only marks the job FAILED, so
    // without this the registration would stay SUBMITTING with no way to retry.
    console.error('[crossref-job]', data.id, `deposit ${row.id}: internal_error`, error);
    const userId = ctx.$config.api.submissionsServiceAccount.id;
    await failDeposit(prisma, { deposit: row, error: 'internal_error', userId }).catch(
      (failError) => {
        console.error('[crossref-job]', data.id, 'could not fail the attempt', failError);
      },
    );
    throw error;
  }
}
