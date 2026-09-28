import { uuidv7 } from 'uuidv7';
import {
  DOI_REGISTRATION_STATUS,
  KnownJobTypes,
  SITE_DOI_CONFIG_STATUS,
} from '@curvenote/scms-core';
import type { Context } from '@curvenote/scms-server';
import { assembleDeposit } from '../deposit/assemble.server.js';
import { depositXmlKey, writePrivateXml } from '../deposit/storage.server.js';
import type { DoiDeps } from '../doi/types.js';
import { fail } from '../jobs/handler.server.js';
import { dispatchJob } from '../jobs/schedule.server.js';
import { commitStart } from './commit.server.js';
import type { Plan } from './commit.server.js';
import { generateFreeDoi } from './doi.server.js';
import * as errors from './errors.js';
import { failDeposit } from './result.server.js';
import type { RegistrationFailure } from './errors.js';

const PUBLISHED = 'PUBLISHED';

type StartRegistrationInput = { siteId: string; submissionId: string; userId: string };

type StartRegistrationResult = { ok: true; doi: string } | RegistrationFailure;

async function loadStart(
  deps: DoiDeps,
  input: StartRegistrationInput,
): Promise<Plan | RegistrationFailure> {
  const submission = await deps.prisma.submission.findFirst({
    where: { id: input.submissionId, site_id: input.siteId },
    select: {
      id: true,
      doi: true,
      versions: {
        where: { status: PUBLISHED },
        orderBy: { date_created: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!submission) {
    return errors.NOT_FOUND;
  }
  const version = submission.versions[0];
  if (!version) {
    return errors.NOT_PUBLISHED;
  }
  // A DOI the work arrived with (a preprint's, say) can sit alongside the one the site registers,
  // so only the submission's own DOI blocks a registration.
  if (submission.doi) {
    return errors.HAS_DOI;
  }
  const existing = await deps.prisma.doiRegistration.findUnique({
    where: { submission_id: submission.id },
    select: { id: true, status: true, doi: true, prefix: true },
  });
  if (existing?.status === DOI_REGISTRATION_STATUS.SUBMITTING) {
    return errors.IN_PROGRESS;
  }
  // A registered row normally also has submission.doi set, so HAS_DOI above answers first. Without
  // this check the retry path would store XML and bump the site's occ only to refuse as IN_PROGRESS.
  if (existing?.status === DOI_REGISTRATION_STATUS.REGISTERED) {
    return errors.HAS_DOI;
  }
  const site = await deps.prisma.siteDoiConfig.findUnique({
    where: { site_id: input.siteId },
    select: { prefix: true, status: true },
  });
  if (!site || site.status !== SITE_DOI_CONFIG_STATUS.ACTIVE) {
    return errors.NOT_ACTIVE;
  }
  // A retry keeps its DOI unless the site's prefix changed: the old DOI can no longer be deposited,
  // so it is replaced. A FAILED attempt does not prove Crossref never received the old one.
  const keepDoi = existing && existing.prefix === site.prefix;
  const doi = keepDoi ? existing.doi : await generateFreeDoi(deps.prisma, site.prefix);
  return {
    siteId: input.siteId,
    submissionId: submission.id,
    versionId: version.id,
    prefix: site.prefix,
    doi,
    retry: existing ? { id: existing.id, doi: existing.doi } : undefined,
  };
}

type FailNotQueuedInput = {
  prisma: DoiDeps['prisma'];
  plan: Plan;
  depositId: string;
  registrationId: string;
  jobId: string;
  userId: string;
};

async function failNotQueued(input: FailNotQueuedInput) {
  const { plan } = input;
  const deposit = {
    id: input.depositId,
    submission_version_id: plan.versionId,
    registration: {
      id: input.registrationId,
      doi: plan.doi,
      submission_id: plan.submissionId,
      site_id: plan.siteId,
    },
  };
  try {
    // Still inside the user's Register request, so the failure is theirs.
    await failDeposit(input.prisma, { deposit, error: 'dispatch_failed', userId: input.userId });
    await fail(input.jobId, `deposit ${input.depositId}: dispatch_failed`);
  } catch (error) {
    console.error('[doi] could not fail the undispatched attempt', input.depositId, error);
  }
}

/**
 * Reads, assembles and stores the XML first (the CDN read must not hold a transaction), then
 * commits everything in one write transaction and dispatches after commit. A blocking issue
 * writes nothing. A lost race leaves only an orphan XML in `prv`, which nothing reads.
 */
export async function startRegistration(
  ctx: Context,
  deps: DoiDeps,
  input: StartRegistrationInput,
): Promise<StartRegistrationResult> {
  const plan = await loadStart(deps, input);
  if ('ok' in plan) {
    return plan;
  }
  const depositId = uuidv7();
  const assembled = await assembleDeposit(ctx, plan.versionId, {
    doi: plan.doi,
    batchId: depositId,
    depositorEmail: deps.creds.depositorEmail,
    resourceUrlBase: deps.creds.resourceUrlBase,
  });
  const { xml, contentType } = assembled;
  if (!xml || !contentType) {
    return { ok: false, status: 400, error: 'The deposit is not ready.', issues: assembled.issues };
  }
  const xmlPath = depositXmlKey(`${depositId}.xml`);
  await writePrivateXml(ctx, xmlPath, xml);
  let committed;
  try {
    committed = await deps.prisma.$transaction((tx) =>
      commitStart(tx, { plan, depositId, xmlPath, contentType, userId: input.userId }),
    );
  } catch (e: any) {
    // A concurrent first start won the submission_id (or doi) unique index. Prisma 7 +
    // adapter-pg drops meta.target, so re-read instead of inspecting it.
    if (e?.code === 'P2002') {
      const winner = await deps.prisma.doiRegistration.findUnique({
        where: { submission_id: plan.submissionId },
        select: { id: true },
      });
      if (winner) {
        return errors.IN_PROGRESS;
      }
    }
    throw e;
  }
  if ('ok' in committed) {
    return committed;
  }
  try {
    await dispatchJob(committed.jobId, KnownJobTypes.CROSSREF_DEPOSIT);
  } catch (error) {
    // The rows are committed but the job may never run, so the registration would stay SUBMITTING
    // with no Retry. Failing the attempt offers Retry instead.
    console.error('[doi] could not dispatch', committed.jobId, error);
    await failNotQueued({
      plan,
      depositId,
      registrationId: committed.registrationId,
      jobId: committed.jobId,
      userId: input.userId,
      prisma: deps.prisma,
    });
    return errors.NOT_QUEUED;
  }
  return { ok: true, doi: plan.doi };
}
