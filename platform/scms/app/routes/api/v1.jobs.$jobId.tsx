import type { Route } from './+types/v1.jobs.$jobId';
import { z } from 'zod';
import {
  ensureJsonBodyFromMethod,
  withContext,
  jobs,
  registerExtensionJobs,
  validate,
} from '@curvenote/scms-server';
import { extensions } from '../../extensions/server';
import { error401, error404, httpError } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';

const UpdateJobPatchBodySchema = z.object({
  status: z.nativeEnum(JobStatus, {
    error: () => `status must be ${Object.values(JobStatus).join(', ')}`,
  }),
  message: z
    .string({
      error: (issue) => (issue.code === 'invalid_type' ? `message must be a string` : undefined),
    })
    .optional(),
  results: z
    .record(z.string().min(0), z.any(), {
      error: (issue) => (issue.code === 'invalid_type' ? 'an object is required' : undefined),
    })
    .optional(),
});

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withContext(args);
  const { jobId } = args.params;
  if (!jobId) throw httpError(400, 'Missing jobId');
  const dto = await jobs.get(ctx, jobId);
  return Response.json(dto, { headers: { 'Access-Control-Allow-Origin': '*' } });
}

export async function action(args: Route.ActionArgs) {
  const ctx = await withContext(args);
  const { jobId } = args.params;

  if (!jobId) throw httpError(400, 'Missing jobId');
  if (!ctx.authorized.handshake && !ctx.authorized.curvenote) throw error401('Unauthorized');
  // SECURED with handshake token & jobId must equal the jobId in the token claims
  if (ctx.authorized.handshake && ctx.claims.handshake?.jobId !== jobId)
    throw error401('Not Authorized for this job id');

  const job = await jobs.get(ctx, jobId);

  if (!job) throw error404(`Job not found ${jobId}`);

  if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
    const statusText = `Cannot update ${job.status} job`;
    throw httpError(400, statusText);
  }

  const body = await ensureJsonBodyFromMethod(args.request, ['PATCH']);
  const data = validate(UpdateJobPatchBodySchema, body);
  const dto = await jobs.update(ctx, jobId, data, registerExtensionJobs(extensions));

  return Response.json(dto);
}
