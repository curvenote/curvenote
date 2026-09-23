import { DOI_DEPOSIT_STATUS, DOI_REGISTRATION_STATUS } from '@curvenote/scms-core';
import type { DoiDeps, DoiTx } from '../doi/types.js';
import { writeRegistrationActivity } from './activity.server.js';

export type DepositRow = {
  id: string;
  status: string;
  submission_version_id: string;
  registration: {
    id: string;
    doi: string;
    status: string;
    submission_id: string;
    site_id: string;
    created_by_id: string;
  };
};

/** Describes the deposit attempt's own transition, not the registration's (see `settleRegistration`). */
type Applied = 'applied' | 'skipped';

const OPEN = [DOI_DEPOSIT_STATUS.PENDING, DOI_DEPOSIT_STATUS.QUEUED];

type SettleDepositData = {
  status: string;
  error?: string | null;
  warning?: string | null;
};

/** Guarded on the open statuses: a redelivered message after a crash changes nothing. */
async function settleDeposit(tx: DoiTx, deposit: DepositRow, data: SettleDepositData) {
  const now = new Date().toISOString();
  const { count } = await tx.doiDeposit.updateMany({
    where: { id: deposit.id, status: { in: OPEN } },
    data: { ...data, completed_at: now, date_modified: now },
  });
  return count === 1;
}

/**
 * Guarded on SUBMITTING: a registration another attempt already resolved (REGISTERED/FAILED)
 * is left untouched, and the caller uses the returned flag to skip the writes that only make
 * sense on the first transition.
 */
async function settleRegistration(tx: DoiTx, deposit: DepositRow, status: string) {
  const now = new Date().toISOString();
  const registeredAt = status === DOI_REGISTRATION_STATUS.REGISTERED ? now : undefined;
  const { count } = await tx.doiRegistration.updateMany({
    where: { id: deposit.registration.id, status: DOI_REGISTRATION_STATUS.SUBMITTING },
    data: { status, registered_at: registeredAt, date_modified: now, occ: { increment: 1 } },
  });
  return count === 1;
}

function activityInput(
  deposit: DepositRow,
  type: 'DOI_REGISTRATION_COMPLETED' | 'DOI_REGISTRATION_FAILED',
  message?: string,
) {
  return {
    type,
    siteId: deposit.registration.site_id,
    submissionId: deposit.registration.submission_id,
    submissionVersionId: deposit.submission_version_id,
    userId: deposit.registration.created_by_id,
    data: { doi: deposit.registration.doi, depositId: deposit.id, message },
  };
}

/** Settles the registration as FAILED; the activity is written only on that first transition. */
async function failRegistration(tx: DoiTx, deposit: DepositRow, message?: string) {
  const failed = await settleRegistration(tx, deposit, DOI_REGISTRATION_STATUS.FAILED);
  if (failed) {
    await writeRegistrationActivity(tx, activityInput(deposit, 'DOI_REGISTRATION_FAILED', message));
  }
}

export type FailDepositInput = { deposit: DepositRow; error: string };

/** Attempt and registration fail with `error`; the site is untouched. */
export function failDeposit(prisma: DoiDeps['prisma'], input: FailDepositInput): Promise<Applied> {
  return prisma.$transaction(async (tx) => {
    if (
      !(await settleDeposit(tx, input.deposit, {
        status: DOI_DEPOSIT_STATUS.FAILED,
        error: input.error,
      }))
    ) {
      return 'skipped';
    }
    await failRegistration(tx, input.deposit, input.error);
    return 'applied';
  });
}
