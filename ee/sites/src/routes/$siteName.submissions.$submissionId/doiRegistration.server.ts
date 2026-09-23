import { DOI_DEPOSIT_STATUS, DOI_REGISTRATION_STATUS } from '@curvenote/scms-core';
import { getPrismaClient } from '@curvenote/scms-server';
import type { DoiRegistrationView } from './types.js';

const SHOWN = new Set<string>([
  DOI_REGISTRATION_STATUS.SUBMITTING,
  DOI_REGISTRATION_STATUS.FAILED,
  DOI_REGISTRATION_STATUS.REGISTERED,
]);

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
  if (!row || !SHOWN.has(row.status)) {
    return null;
  }
  return {
    status: row.status as DoiRegistrationView['status'],
    doi: row.doi,
    retried: row.status === DOI_REGISTRATION_STATUS.SUBMITTING && row._count.attempts > 0,
  };
}
