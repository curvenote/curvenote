import type { Route } from './+types/v1.works.$workId.versions.$workVersionId.contains';
import { z } from 'zod';
import {
  ensureJsonBodyFromMethod,
  validate,
  withAPISecureContext,
  getPrismaClient,
  mergeWorkContains,
} from '@curvenote/scms-server';
import { error401, error404, error405, httpError } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';

/** PATCH body: labels to merge into Work.contains and WorkVersion.contains. */
const MergeContainsPatchBodySchema = z.object({
  contains: z.array(z.string().min(1)).min(1),
});

export async function loader() {
  throw error405();
}

/**
 * PATCH /v1/works/:workId/versions/:workVersionId/contains
 *
 * Merge labels into Work.contains and WorkVersion.contains (union, deduped).
 * Requires handshake; jobId must be linked to this work version and QUEUED/RUNNING.
 */
export async function action(args: Route.ActionArgs) {
  const ctx = await withAPISecureContext(args);
  if (args.request.method !== 'PATCH') throw error404();

  if (!ctx.authorized.handshake) throw error401();
  const handshakeJobId = ctx.$handshakeClaims?.jobId;
  if (!handshakeJobId) throw error401();

  const { workId, workVersionId } = args.params;
  if (!workId) throw httpError(400, 'workId is required');
  if (!workVersionId) throw httpError(400, 'workVersionId is required');

  const prisma = await getPrismaClient();

  const workVersion = await prisma.workVersion.findUnique({
    where: { id: workVersionId },
    select: { id: true, work_id: true, contains: true },
  });
  if (!workVersion) throw httpError(404, 'work version not found');
  if (workVersion.work_id !== workId) throw httpError(404, 'work version not found');

  const linked = await prisma.linkedJob.findFirst({
    where: { work_version_id: workVersionId, job_id: handshakeJobId },
    include: { job: { select: { id: true, status: true } } },
  });
  if (!linked) throw httpError(403, 'job not linked to this work version');
  if (linked.job.status !== JobStatus.QUEUED && linked.job.status !== JobStatus.RUNNING) {
    throw httpError(403, 'job must be QUEUED or RUNNING to update contains');
  }

  const body = await ensureJsonBodyFromMethod(args.request, ['PATCH']);
  const { contains: incoming } = validate(MergeContainsPatchBodySchema, body);

  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: { id: true, contains: true },
  });
  if (!work) throw httpError(404, 'work not found');

  const versionContains = mergeWorkContains(workVersion.contains, incoming);
  const workContains = mergeWorkContains(work.contains, incoming);
  const dateModified = new Date().toISOString();

  await prisma.$transaction([
    prisma.workVersion.update({
      where: { id: workVersionId },
      data: { contains: versionContains, date_modified: dateModified },
    }),
    prisma.work.update({
      where: { id: workId },
      data: { contains: { set: workContains }, date_modified: dateModified },
    }),
  ]);

  return Response.json(
    {
      id: workVersionId,
      work_id: workId,
      contains: versionContains,
      work_contains: workContains,
    },
    { status: 200 },
  );
}
