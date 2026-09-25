import { DOI_DEPOSIT_STATUS, KnownJobTypes, SITE_DOI_CONFIG_STATUS } from '@curvenote/scms-core';
import type { Context, CreateJob } from '@curvenote/scms-core';
import { getPrismaClient } from '@curvenote/scms-server';
import { CrossrefError, crossrefCredentialsFromConfig } from '../crossref/client.server.js';
import { fetchDepositResult } from '../crossref/depositResult.server.js';
import { resultXmlKey, writePrivateXml } from '../deposit/storage.server.js';
import type { DoiDeps } from '../doi/types.js';
import { applyDepositResult, failDeposit } from '../registration/result.server.js';
import { pastHorizon, pollScheduledAt } from './backoff.js';
import { complete, fail, loadDeposit, parsePayload } from './handler.server.js';
import type { CrossrefJobPayload, JobDepositRow } from './handler.server.js';
import { insertJobRow } from './schedule.server.js';
import { loadJobSite } from './site.server.js';

const NO_RESULT = 'no_result_after_72h';

/** Why this poll found no result; only for the job row's message. */
type Pending = { reason: string; crossrefSubmissionId?: string };

type PollInput = {
  ctx: Context;
  prisma: DoiDeps['prisma'];
  row: JobDepositRow;
  role: string;
  jobId: string;
  userId: string;
};

/**
 * One read of Crossref's result. Returns the job's completion when the attempt is settled, or why
 * there is no result yet. Only a Crossref answer settles the attempt: every other error is "no
 * result yet", because polling only reads and Crossref keeps the result, and failing here after
 * Crossref said Success would show a registered DOI as unsuccessful.
 */
async function pollOnce({ ctx, prisma, row, role, jobId, userId }: PollInput) {
  const creds = crossrefCredentialsFromConfig(ctx.$config);
  try {
    const result = await fetchDepositResult(creds, { role, fileName: row.file_name });
    if (result.state === 'unauthorized') {
      await failDeposit(prisma, { deposit: row, error: 'site_credentials_rejected', userId });
      return { done: await complete(jobId, `deposit ${row.id}: unauthorized, attempt failed`) };
    }
    if (result.state === 'completed') {
      const resultXmlPath = resultXmlKey(row.file_name);
      await writePrivateXml(ctx, resultXmlPath, result.xml);
      await applyDepositResult(prisma, { deposit: row, result, resultXmlPath, userId });
      return { done: await complete(jobId, `deposit ${row.id}: ${result.outcome}`) };
    }
    if (result.state === 'queued') {
      const pending: Pending = {
        reason: `queued at Crossref (submission ${result.submissionId})`,
        crossrefSubmissionId: result.submissionId,
      };
      return { pending };
    }
    return { pending: { reason: 'not yet known to Crossref' } };
  } catch (error) {
    if (!(error instanceof CrossrefError)) {
      console.error('[crossref-job]', jobId, `deposit ${row.id}: poll error, retrying`, error);
    }
    const message = error instanceof Error ? error.message : String(error);
    return { pending: { reason: `${message}; no result yet` } };
  }
}

type ReschedulePollInput = {
  prisma: DoiDeps['prisma'];
  row: JobDepositRow;
  payload: CrossrefJobPayload;
  crossrefSubmissionId?: string;
};

/**
 * The next poll is a new SCHEDULED job row, inserted only when the attempt is still QUEUED so a
 * redelivered message never leaves a poll nobody needs. `crossrefSubmissionId` is undefined when
 * this poll did not learn it, and Prisma skips an undefined field, so a known id is never cleared.
 */
async function reschedulePoll({ prisma, row, payload, crossrefSubmissionId }: ReschedulePollInput) {
  const scheduledAt = pollScheduledAt(new Date(), payload.attempt + 1);
  const rescheduled = await prisma.$transaction(async (tx) => {
    const updated = await tx.doiDeposit.updateMany({
      where: { id: row.id, status: DOI_DEPOSIT_STATUS.QUEUED },
      data: {
        crossref_submission_id: crossrefSubmissionId,
        date_modified: new Date().toISOString(),
      },
    });
    if (updated.count === 0) {
      return false;
    }
    const job = await insertJobRow(tx, {
      jobType: KnownJobTypes.CROSSREF_POLL,
      payload: { ...payload, attempt: payload.attempt + 1 },
      scheduledAt,
    });
    await tx.doiDeposit.update({ where: { id: row.id }, data: { job_id: job.jobId } });
    return true;
  });
  return { scheduledAt, rescheduled };
}

/**
 * Reads the result of one received deposit. A processed result settles the attempt; anything else
 * polls again later, until 72 h after the attempt started. The result is the job's doing, not the
 * Register click's, so its activity goes to the platform service account; the user who started
 * the registration may also be gone by the time Crossref answers.
 */
export async function crossrefPollHandler(ctx: Context, data: CreateJob) {
  const payload = parsePayload(data.payload);
  const prisma = await getPrismaClient();
  const row = await loadDeposit(prisma, payload.depositId);
  if (!row) {
    return fail(data.id, `Deposit ${payload.depositId} not found`);
  }
  if (row.status !== DOI_DEPOSIT_STATUS.QUEUED) {
    return complete(data.id, `no-op: deposit ${row.id} is ${row.status}`);
  }
  const userId = ctx.$config.api.submissionsServiceAccount.id;
  const site = await loadJobSite(prisma, payload.siteId);
  if (!site || site.status !== SITE_DOI_CONFIG_STATUS.ACTIVE) {
    await failDeposit(prisma, { deposit: row, error: 'site_not_active', userId });
    return complete(data.id, `deposit ${row.id}: site is not ACTIVE, attempt failed`);
  }
  const role = site.role ?? crossrefCredentialsFromConfig(ctx.$config).role;
  const polled = await pollOnce({ ctx, prisma, row, role, jobId: data.id, userId });
  if ('done' in polled) {
    return polled.done;
  }
  const { reason, crossrefSubmissionId } = polled.pending;
  if (pastHorizon(row, new Date())) {
    await failDeposit(prisma, { deposit: row, error: NO_RESULT, userId });
    return complete(data.id, `deposit ${row.id}: ${NO_RESULT}`);
  }
  const { scheduledAt, rescheduled } = await reschedulePoll({
    prisma,
    row,
    payload,
    crossrefSubmissionId,
  });
  if (!rescheduled) {
    return complete(
      data.id,
      `deposit ${row.id}: ${reason}; already advanced by another delivery, not rescheduled`,
    );
  }
  return complete(data.id, `deposit ${row.id}: ${reason}, next poll ${scheduledAt}`);
}
