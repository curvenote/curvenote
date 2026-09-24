import { uuidv7 } from 'uuidv7';
import {
  DOI_DEPOSIT_STATUS,
  DOI_REGISTRATION_STATUS,
  KnownJobTypes,
  SITE_DOI_CONFIG_STATUS,
} from '@curvenote/scms-core';
import { depositTypeForKind } from '../deposit/mapper.js';
import type { DoiTx } from '../doi/types.js';
import { kindTitle } from '../kinds.utils.js';
import { insertJobRow } from '../jobs/schedule.server.js';
import { writeRegistrationActivity } from './activity.server.js';
import * as errors from './errors.js';
import type { RegistrationFailure } from './errors.js';

/** What the write transaction needs, decided before assembly. */
export type Plan = {
  siteId: string;
  submissionId: string;
  versionId: string;
  prefix: string;
  doi: string;
  /** Set on a FAILED retry: the row to flip back to SUBMITTING, matched on its current doi. */
  retry?: { id: string; doi: string };
};

/** Bumping occ with ACTIVE in the WHERE serializes against unlink-role / reset, which bump it too. */
async function lockActiveSite(tx: DoiTx, siteId: string) {
  const { count } = await tx.siteDoiConfig.updateMany({
    where: { site_id: siteId, status: SITE_DOI_CONFIG_STATUS.ACTIVE },
    data: { occ: { increment: 1 } },
  });
  return count === 1;
}

type CommitInput = { plan: Plan; depositId: string; xmlPath: string; userId: string };

/** The only write: registration SUBMITTING, attempt PENDING, job row and activity together. */
export async function commitStart(
  tx: DoiTx,
  { plan, depositId, xmlPath, userId }: CommitInput,
): Promise<{ registrationId: string; jobId: string } | RegistrationFailure> {
  if (!(await lockActiveSite(tx, plan.siteId))) {
    return errors.NOT_ACTIVE;
  }
  const site = await tx.siteDoiConfig.findUnique({
    where: { site_id: plan.siteId },
    select: { prefix: true },
  });
  if (site?.prefix !== plan.prefix) {
    return errors.PREFIX_CHANGED;
  }
  // Saving the kind mapping bumps the same occ, so this read comes after any save that raced
  // with the assembly and sees the kind as it is now.
  const submission = await tx.submission.findUnique({
    where: { id: plan.submissionId },
    select: { kind: { select: { name: true, content: true, doi_content_type: true } } },
  });
  if (!submission) {
    return errors.NOT_FOUND;
  }
  if (!depositTypeForKind(submission.kind.doi_content_type)) {
    return errors.kindNotEligible(kindTitle(submission.kind));
  }
  const now = new Date().toISOString();
  let registrationId: string;
  if (plan.retry) {
    // DRAFT is the column default and nothing here writes it; a row left in it retries like FAILED.
    const { count } = await tx.doiRegistration.updateMany({
      where: {
        id: plan.retry.id,
        doi: plan.retry.doi,
        status: { in: [DOI_REGISTRATION_STATUS.FAILED, DOI_REGISTRATION_STATUS.DRAFT] },
      },
      data: {
        status: DOI_REGISTRATION_STATUS.SUBMITTING,
        doi: plan.doi,
        prefix: plan.prefix,
        date_modified: now,
        occ: { increment: 1 },
      },
    });
    if (count !== 1) {
      return errors.IN_PROGRESS;
    }
    registrationId = plan.retry.id;
  } else {
    const created = await tx.doiRegistration.create({
      data: {
        id: uuidv7(),
        date_created: now,
        date_modified: now,
        submission_id: plan.submissionId,
        site_id: plan.siteId,
        doi: plan.doi,
        prefix: plan.prefix,
        status: DOI_REGISTRATION_STATUS.SUBMITTING,
        created_by_id: userId,
      },
      select: { id: true },
    });
    registrationId = created.id;
  }
  const job = await insertJobRow(tx, {
    jobType: KnownJobTypes.CROSSREF_DEPOSIT,
    payload: { depositId, siteId: plan.siteId, attempt: 1 },
    invokedById: userId,
  });
  await tx.doiDeposit.create({
    data: {
      id: depositId,
      date_created: now,
      date_modified: now,
      registration_id: registrationId,
      submission_version_id: plan.versionId,
      file_name: `${depositId}.xml`,
      doi_batch_id: depositId,
      xml_path: xmlPath,
      status: DOI_DEPOSIT_STATUS.PENDING,
      job_id: job.jobId,
    },
    select: { id: true },
  });
  await writeRegistrationActivity(tx, {
    type: 'DOI_REGISTRATION_STARTED',
    siteId: plan.siteId,
    submissionId: plan.submissionId,
    submissionVersionId: plan.versionId,
    userId,
    data: { doi: plan.doi, depositId },
  });
  return { registrationId, jobId: job.jobId };
}
