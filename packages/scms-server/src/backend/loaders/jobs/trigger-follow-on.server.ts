import type { Context } from '../../context.server.js';
import { createFollowOnSchemas } from '@curvenote/scms-core';
import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '../../prisma.server.js';

export type CreateJobFn = (ctx: Context, data: { id: string; job_type: string; payload: Record<string, any> }) => Promise<unknown>;

/**
 * If the job is COMPLETED and has follow_on.on_success, create the follow-on job via createJobFn.
 * Uses relaxed validation (job_type string) when parsing stored follow_on; the create path validates job type.
 */
export async function triggerFollowOn(
  ctx: Context,
  jobId: string,
  createJobFn: CreateJobFn,
): Promise<void> {
  const prisma = await getPrismaClient();
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { status: true, follow_on: true },
  });
  if (!job || job.status !== 'COMPLETED') return;

  const raw = job.follow_on;
  if (raw == null || typeof raw !== 'object') return;

  const { FollowOnSchemaRelaxed } = createFollowOnSchemas([]);
  const parsed = FollowOnSchemaRelaxed.safeParse(raw);
  if (!parsed.success) {
    console.error('[triggerFollowOn] Invalid follow_on for job', jobId, parsed.error);
    return;
  }

  const { on_success } = parsed.data;
  const id = on_success.id ?? uuidv7();
  try {
    await createJobFn(ctx, {
      id,
      job_type: on_success.job_type,
      payload: on_success.payload,
    });
  } catch (err) {
    console.error('[triggerFollowOn] Failed to create follow-on job for', jobId, err);
    throw err;
  }
}
