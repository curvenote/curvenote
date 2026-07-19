import { JobStatus, Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '../../prisma.server.js';
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
      invoked_by_id: invoked_by_id ?? undefined,
      activity_type: activity_type ?? undefined,
    },
  });
}

/**
 * Mark a job RUNNING. Updates an existing row (async enqueue / runHandler) or creates one (legacy invoke).
 */
export async function dbStartJob(data: CreateJob, status = JobStatus.RUNNING) {
  const prisma = await getPrismaClient();
  const existing = await prisma.job.findUnique({ where: { id: data.id } });
  if (existing) {
    return dbUpdateJob(data.id, { status });
  }
  return dbCreateJob({ ...data, status });
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
      messages: data.message ? { push: data.message } : undefined,
    },
  });
}
