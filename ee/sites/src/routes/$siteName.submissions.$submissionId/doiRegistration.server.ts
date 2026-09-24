import { DOI_DEPOSIT_STATUS, DOI_REGISTRATION_STATUS } from '@curvenote/scms-core';
import { getPrismaClient } from '@curvenote/scms-server';
import type { DoiReadiness } from '../../backend/deposit/readiness.server.js';
import { describeDoiFailure } from '../../backend/registration/failure.js';
import type { DoiRegistrationView, DoiRowState } from './types.js';

/**
 * The DOI row's state, from the registration and its latest attempt. Scoped to the site because the
 * submission id can come from a URL. Any other status (a legacy DRAFT) leaves the Register button.
 */
export async function loadDoiRegistrationView(
  siteId: string,
  submissionId: string,
): Promise<DoiRegistrationView | null> {
  const prisma = await getPrismaClient();
  const row = await prisma.doiRegistration.findFirst({
    where: { submission_id: submissionId, site_id: siteId },
    select: {
      status: true,
      doi: true,
      attempts: {
        orderBy: { date_created: 'desc' },
        take: 1,
        select: { status: true, error: true, warning: true },
      },
      _count: { select: { attempts: { where: { status: DOI_DEPOSIT_STATUS.FAILED } } } },
    },
  });
  if (!row) {
    return null;
  }
  const latest = row.attempts[0];
  switch (row.status) {
    case DOI_REGISTRATION_STATUS.SUBMITTING:
      return {
        status: 'SUBMITTING',
        doi: row.doi,
        phase: latest?.status === DOI_DEPOSIT_STATUS.QUEUED ? 'waiting' : 'sending',
        retried: row._count.attempts > 0,
      };
    case DOI_REGISTRATION_STATUS.FAILED:
      return { status: 'FAILED', doi: row.doi, reason: describeDoiFailure(latest?.error ?? null) };
    case DOI_REGISTRATION_STATUS.REGISTERED:
      return { status: 'REGISTERED', doi: row.doi, warning: latest?.warning ?? undefined };
    default:
      return null;
  }
}

type DoiRowSources = {
  /** The DOI the rest of the page shows for the active version (`resolveSiteWorkDoi`). */
  doi: string | undefined;
  registration: DoiRegistrationView | null;
  /** Null when the viewer can't see DOI registration. */
  startReadiness: (() => Promise<DoiReadiness>) | null;
};

/**
 * The one place that decides what the DOI row shows. A registration wins over the DOI, so a
 * registered one keeps its warning; the exception is a failed registration of a work that resolves
 * to a DOI of its own, where Retry would be refused and the page already shows that DOI.
 */
export function doiRowState({ doi, registration, startReadiness }: DoiRowSources): DoiRowState {
  if (registration && !(registration.status === 'FAILED' && doi)) {
    return { kind: 'registration', registration };
  }
  if (doi) {
    return { kind: 'doi', doi };
  }
  if (startReadiness) {
    return { kind: 'register', readiness: startReadiness() };
  }
  return { kind: 'none' };
}
