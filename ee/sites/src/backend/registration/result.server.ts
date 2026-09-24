import { DOI_DEPOSIT_STATUS, DOI_REGISTRATION_STATUS } from '@curvenote/scms-core';
import type { ParsedDepositResult } from '../crossref/depositResult.server.js';
import type { DoiDeps, DoiTx } from '../doi/types.js';
import { writeRegistrationActivity } from './activity.server.js';
import { CROSSREF_REJECTED } from './failure.js';
import type { DoiFailureCode } from './failure.js';

type DepositRow = {
  id: string;
  submission_version_id: string;
  registration: {
    id: string;
    doi: string;
    submission_id: string;
    site_id: string;
  };
};

type Completed = Extract<ParsedDepositResult, { state: 'completed' }>;

/** An attempt is open while it is being sent (PENDING) or waiting for Crossref (QUEUED). */
const OPEN = [DOI_DEPOSIT_STATUS.PENDING, DOI_DEPOSIT_STATUS.QUEUED];

type SettleDepositData = {
  status: string;
  error?: string;
  warning?: string;
  result_xml_path?: string;
};

/**
 * Closes the attempt. Guarded on the open statuses, so a redelivered job message changes nothing
 * and every write that follows in the caller runs at most once per attempt.
 */
async function settleDeposit(tx: DoiTx, deposit: DepositRow, data: SettleDepositData) {
  const now = new Date().toISOString();
  const { count } = await tx.doiDeposit.updateMany({
    where: { id: deposit.id, status: { in: OPEN } },
    data: { ...data, completed_at: now, date_modified: now },
  });
  return count === 1;
}

type ResultActivity =
  | { type: 'DOI_REGISTRATION_COMPLETED'; warning?: string }
  | { type: 'DOI_REGISTRATION_FAILED'; error: string };

function writeActivity(tx: DoiTx, deposit: DepositRow, userId: string, activity: ResultActivity) {
  const { type, ...result } = activity;
  return writeRegistrationActivity(tx, {
    type,
    siteId: deposit.registration.site_id,
    submissionId: deposit.registration.submission_id,
    submissionVersionId: deposit.submission_version_id,
    userId,
    data: { doi: deposit.registration.doi, depositId: deposit.id, ...result },
  });
}

/**
 * Moves the registration out of SUBMITTING. Guarded on SUBMITTING, so a registration another
 * attempt already resolved is left as it is and the caller skips its one-off writes.
 */
async function leaveSubmitting(tx: DoiTx, deposit: DepositRow, status: string) {
  const now = new Date().toISOString();
  const registeredAt = status === DOI_REGISTRATION_STATUS.REGISTERED ? now : undefined;
  const { count } = await tx.doiRegistration.updateMany({
    where: { id: deposit.registration.id, status: DOI_REGISTRATION_STATUS.SUBMITTING },
    data: { status, registered_at: registeredAt, date_modified: now, occ: { increment: 1 } },
  });
  return count === 1;
}

async function failRegistration(tx: DoiTx, deposit: DepositRow, userId: string, error: string) {
  if (await leaveSubmitting(tx, deposit, DOI_REGISTRATION_STATUS.FAILED)) {
    await writeActivity(tx, deposit, userId, { type: 'DOI_REGISTRATION_FAILED', error });
  }
}

/** `Submission.doi` is what resolution reads, so it is set exactly once, with REGISTERED. */
async function registerSubmission(
  tx: DoiTx,
  deposit: DepositRow,
  userId: string,
  warning?: string,
) {
  if (!(await leaveSubmitting(tx, deposit, DOI_REGISTRATION_STATUS.REGISTERED))) {
    return;
  }
  await tx.submission.update({
    where: { id: deposit.registration.submission_id },
    data: { doi: deposit.registration.doi },
    select: { id: true },
  });
  await writeActivity(tx, deposit, userId, { type: 'DOI_REGISTRATION_COMPLETED', warning });
}

/** Crossref's messages for the records with this status, or undefined when it gave none. */
function messagesOf(result: Completed, status: Completed['outcome']) {
  const messages = result.records
    .filter((record) => record.status === status && record.message)
    .map((record) => record.message);
  return messages.length > 0 ? messages.join(' | ') : undefined;
}

/**
 * `userId` is who the DOI_REGISTRATION_FAILED activity is attributed to. The caller names it
 * because a failure can land long after the Register click, when the user who started the
 * registration may no longer exist.
 */
type FailDepositInput = { deposit: DepositRow; error: DoiFailureCode; userId: string };

/** Attempt and registration fail with `error`; the site is untouched. */
export async function failDeposit(prisma: DoiDeps['prisma'], input: FailDepositInput) {
  const { deposit, error, userId } = input;
  await prisma.$transaction(async (tx) => {
    if (await settleDeposit(tx, deposit, { status: DOI_DEPOSIT_STATUS.FAILED, error })) {
      await failRegistration(tx, deposit, userId, error);
    }
  });
}

/** `userId` is who the result activity is attributed to, as for `failDeposit`. */
type ApplyDepositResultInput = {
  deposit: DepositRow;
  result: Completed;
  resultXmlPath: string;
  userId: string;
};

/**
 * Settles one attempt on Crossref's processed result, in one transaction: success and warning
 * register the DOI, failure fails the registration with Crossref's message. Work DOIs are never
 * written: the registered DOI belongs to the submission.
 */
export async function applyDepositResult(
  prisma: DoiDeps['prisma'],
  input: ApplyDepositResultInput,
) {
  const { deposit, result, resultXmlPath, userId } = input;
  await prisma.$transaction(async (tx) => {
    if (result.outcome === 'failure') {
      const error = messagesOf(result, 'failure') ?? CROSSREF_REJECTED;
      const settled = await settleDeposit(tx, deposit, {
        status: DOI_DEPOSIT_STATUS.FAILED,
        error,
        result_xml_path: resultXmlPath,
      });
      if (settled) {
        await failRegistration(tx, deposit, userId, error);
      }
      return;
    }
    const warning = result.outcome === 'warning' ? messagesOf(result, 'warning') : undefined;
    const settled = await settleDeposit(tx, deposit, {
      status: DOI_DEPOSIT_STATUS.SUCCEEDED,
      warning,
      result_xml_path: resultXmlPath,
    });
    if (settled) {
      await registerSubmission(tx, deposit, userId, warning);
    }
  });
}
