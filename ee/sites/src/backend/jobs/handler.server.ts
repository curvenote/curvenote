import { z } from 'zod';
import { JobStatus } from '@curvenote/scms-db';
import type { Prisma } from '@curvenote/scms-db';
import { dbUpdateJob } from '@curvenote/scms-server';
import type { DoiDeps } from '../doi/types.js';

/**
 * Shared by the Crossref job handlers: loads the deposit row, parses the job payload, and writes
 * the job row's terminal status. Kept out of each handler so every Crossref job handler reads the
 * same shapes and the same completion helpers.
 */
const depositRowSelect = {
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
    },
  },
} satisfies Prisma.DoiDepositSelect;

export type JobDepositRow = Prisma.DoiDepositGetPayload<{ select: typeof depositRowSelect }>;

export function loadDeposit(prisma: DoiDeps['prisma'], depositId: string) {
  return prisma.doiDeposit.findUnique({ where: { id: depositId }, select: depositRowSelect });
}

const PayloadSchema = z.object({
  depositId: z.string().min(1),
  siteId: z.string().min(1),
  attempt: z.number().int().min(1).default(1),
});

export type CrossrefJobPayload = z.output<typeof PayloadSchema>;

export function parsePayload(payload: unknown): CrossrefJobPayload {
  return PayloadSchema.parse(payload);
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
