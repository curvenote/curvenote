import { JobStatus, Prisma } from '@prisma/client';
import { getPrismaClient } from '../../../prisma.server.js';
import { formatDate } from '@curvenote/common';
import type { CreateJob, UpdateJob } from '@curvenote/scms-core';

export async function dbCreateJob({ id, job_type, payload, status, results, message }: CreateJob) {
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
    },
  });
}

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
