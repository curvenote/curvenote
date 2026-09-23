import { DOI_DEPOSIT_STATUS, DOI_REGISTRATION_STATUS } from '@curvenote/scms-core';
import { getPrismaClient } from '@curvenote/scms-server';
import type { DoiRegistrationView } from './types.js';

/** The statuses the DOI row has a state for. Any other row (DRAFT) leaves the Register button. */
function shownStatus(status: string): DoiRegistrationView['status'] | null {
  switch (status) {
    case DOI_REGISTRATION_STATUS.SUBMITTING:
    case DOI_REGISTRATION_STATUS.FAILED:
    case DOI_REGISTRATION_STATUS.REGISTERED:
      return status;
    default:
      return null;
  }
}

/** The DOI row's state. `retried`: in progress again after a failed attempt ("Resubmitting…"). */
export async function loadDoiRegistrationView(
  submissionId: string,
): Promise<DoiRegistrationView | null> {
  const prisma = await getPrismaClient();
  const row = await prisma.doiRegistration.findUnique({
    where: { submission_id: submissionId },
    select: {
      status: true,
      doi: true,
      _count: { select: { attempts: { where: { status: DOI_DEPOSIT_STATUS.FAILED } } } },
    },
  });
  const status = row ? shownStatus(row.status) : null;
  if (!row || !status) {
    return null;
  }
  return {
    status,
    doi: row.doi,
    retried: status === DOI_REGISTRATION_STATUS.SUBMITTING && row._count.attempts > 0,
  };
}
