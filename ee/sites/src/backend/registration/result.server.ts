import { DOI_DEPOSIT_STATUS, DOI_REGISTRATION_STATUS } from '@curvenote/scms-core';
import type { DoiDeps } from '../doi/types.js';
import { writeRegistrationActivity } from './activity.server.js';

type DepositRow = {
  id: string;
  submission_version_id: string;
  registration: {
    id: string;
    doi: string;
    submission_id: string;
    site_id: string;
    created_by_id: string;
  };
};

type FailDepositInput = { deposit: DepositRow; error: string };

/**
 * Attempt and registration fail with `error`; the site is untouched. Both updates are guarded on
 * the status they leave (attempt PENDING, registration SUBMITTING), so a redelivered job changes
 * nothing and the DOI_REGISTRATION_FAILED activity is written once.
 */
export async function failDeposit(prisma: DoiDeps['prisma'], input: FailDepositInput) {
  const { deposit, error } = input;
  await prisma.$transaction(async (tx) => {
    const now = new Date().toISOString();
    const attempt = await tx.doiDeposit.updateMany({
      where: { id: deposit.id, status: DOI_DEPOSIT_STATUS.PENDING },
      data: { status: DOI_DEPOSIT_STATUS.FAILED, error, completed_at: now, date_modified: now },
    });
    if (attempt.count === 0) {
      return;
    }
    const registration = await tx.doiRegistration.updateMany({
      where: { id: deposit.registration.id, status: DOI_REGISTRATION_STATUS.SUBMITTING },
      data: { status: DOI_REGISTRATION_STATUS.FAILED, date_modified: now, occ: { increment: 1 } },
    });
    if (registration.count === 0) {
      return;
    }
    await writeRegistrationActivity(tx, {
      type: 'DOI_REGISTRATION_FAILED',
      siteId: deposit.registration.site_id,
      submissionId: deposit.registration.submission_id,
      submissionVersionId: deposit.submission_version_id,
      userId: deposit.registration.created_by_id,
      data: { doi: deposit.registration.doi, depositId: deposit.id, message: error },
    });
  });
}
