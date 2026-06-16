import { JobTriggerOn, Prisma } from '@curvenote/scms-db';
import type { JobStatus, PrismaClient } from '@curvenote/scms-db';
import type { FollowOnEnvelope, JobTriggerOn as JobTriggerOnType } from '@curvenote/scms-core';
import { formatDate } from '@curvenote/common';
import { getPrismaClient } from '../../prisma.server.js';

export type EnsureJobRowParams = {
  job_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  invoked_by_id?: string;
  activity_type?: string;
  follow_on?: FollowOnEnvelope;
  depends_on_job_id?: string;
  trigger_on?: JobTriggerOnType;
  results?: Record<string, unknown>;
};

function toPrismaTriggerOn(triggerOn?: JobTriggerOnType): JobTriggerOn | undefined {
  if (triggerOn === 'success') return JobTriggerOn.SUCCESS;
  if (triggerOn === 'failure') return JobTriggerOn.FAILURE;
  return undefined;
}

export async function ensureJobRow(
  params: EnsureJobRowParams,
  status: Extract<JobStatus, 'QUEUED' | 'BLOCKED'>,
  prismaClient?: PrismaClient | Prisma.TransactionClient,
) {
  const prisma = prismaClient ?? (await getPrismaClient());
  const existing = await prisma.job.findUnique({ where: { id: params.job_id } });
  if (existing) {
    console.log('[ensureJobRow] row already exists, skipping insert (idempotent)', {
      job_id: params.job_id,
      job_type: params.job_type,
      status: existing.status,
    });
    return existing;
  }

  const date_created = formatDate();
  return prisma.job.create({
    data: {
      id: params.job_id,
      date_created,
      date_modified: date_created,
      job_type: params.job_type,
      status,
      payload: (params.payload === null
        ? Prisma.JsonNull
        : params.payload) as Prisma.InputJsonValue,
      results: params.results == null ? Prisma.JsonNull : (params.results as Prisma.InputJsonValue),
      follow_on:
        params.follow_on == null ? Prisma.JsonNull : (params.follow_on as Prisma.InputJsonValue),
      invoked_by_id: params.invoked_by_id ?? undefined,
      activity_type: params.activity_type ?? undefined,
      depends_on_job_id: params.depends_on_job_id ?? undefined,
      trigger_on: toPrismaTriggerOn(params.trigger_on),
    },
  });
}
