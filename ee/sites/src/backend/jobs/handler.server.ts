import { JobStatus } from '@curvenote/scms-db';
import type { Prisma } from '@curvenote/scms-db';
import { dbUpdateJob } from '@curvenote/scms-server';
import type { DoiDeps } from '../doi/types.js';
import type { CrossrefJobPayload } from './schedule.server.js';

/** Shared by the Crossref job handlers (CROSSREF_POLL arrives in CN-2582): loads the deposit row, parses the job payload, and
 * writes the job row's terminal status. Kept out of each handler so `crossrefDeposit.server.ts`
 * and `crossrefPoll.server.ts` read the same shapes and the same completion helpers. */

export const depositRowSelect = {
  id: true,
  status: true,
  file_name: true,
  xml_path: true,
  date_created: true,
  submission_version_id: true,
  registration: {
    select: {
      id: true,
      doi: true,
      status: true,
      submission_id: true,
      site_id: true,
      created_by_id: true,
    },
  },
} satisfies Prisma.DoiDepositSelect;

export type JobDepositRow = Prisma.DoiDepositGetPayload<{ select: typeof depositRowSelect }>;

export function loadDeposit(prisma: DoiDeps['prisma'], depositId: string) {
  return prisma.doiDeposit.findUnique({ where: { id: depositId }, select: depositRowSelect });
}

export function parsePayload(payload: unknown): CrossrefJobPayload {
  const p = payload as Partial<CrossrefJobPayload>;
  if (typeof p?.depositId !== 'string' || typeof p?.siteId !== 'string') {
    throw new Error('Crossref job payload needs depositId and siteId');
  }
  return {
    depositId: p.depositId,
    siteId: p.siteId,
    attempt: typeof p.attempt === 'number' ? p.attempt : 1,
  };
}

/** Handlers end through here: a message on the job row, a terminal status back to the runner. */
export function complete(jobId: string, message: string) {
  console.log('[crossref-job]', jobId, message);
  return dbUpdateJob(jobId, { status: JobStatus.COMPLETED, message });
}

export function fail(jobId: string, message: string) {
  console.error('[crossref-job]', jobId, message);
  return dbUpdateJob(jobId, { status: JobStatus.FAILED, message });
}
