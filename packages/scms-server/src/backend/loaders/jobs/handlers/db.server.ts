import { JobStatus, Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '../../../prisma.server.js';
import { formatDate } from '@curvenote/common';
import type { CreateJob, UpdateJob } from '@curvenote/scms-core';

/**
 * Creates a new job row from the given CreateJob payload.
 * Persists invoked_by_id and activity_type when provided (for start-activity attribution).
 */
export async function dbCreateJob({
  id,
  job_type,
  payload,
  status,
  results,
  message,
  follow_on,
  invoked_by_id,
  activity_type,
}: CreateJob) {
  const date_created = formatDate();
  const prisma = await getPrismaClient();
  return prisma.job.create({
    data: {
      id,
      date_created,
      date_modified: date_created,
      job_type,
      status: status ?? JobStatus.QUEUED,
      payload: payload === null ? Prisma.JsonNull : payload,
      results: results == null ? Prisma.JsonNull : results,
      messages: message ? [message] : [],
      follow_on: follow_on == null ? Prisma.JsonNull : (follow_on as Prisma.InputJsonValue),
      invoked_by_id: invoked_by_id ?? undefined,
      activity_type: activity_type ?? undefined,
    },
  });
}

/**
 * Updates a job by id with the given fields (status, results, message).
 *
 * @param id - Job id.
 * @param data - Update payload (status, results, message).
 * @returns The updated job row.
 */
export async function dbUpdateJob(id: string, data: UpdateJob) {
  const prisma = await getPrismaClient();
  return prisma.job.update({
    where: { id },
    data: {
      date_modified: formatDate(),
      status: data.status ?? undefined,
      results: data.results ?? undefined,
      messages: {
        push: data.message ?? [],
      },
    },
  });
}
