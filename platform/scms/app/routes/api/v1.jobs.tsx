import type { Route } from './+types/v1.jobs';
import { error401, error405 } from '@curvenote/scms-core';
import {
  ensureJsonBodyFromMethod,
  jobs,
  withContext,
  createJobPostBodySchema,
  validate,
  registerExtensionJobs,
} from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';
import { extensions } from '../../extensions/server';

// extend vercel timeout to maximum 10 minutes
export const config = {
  maxDuration: 300,
};

export async function loader() {
  throw error405();
}

/**
 * Create new job
 *
 * The entire request payload is passed to pub/sub queue, except job_type.
 * A handshake value is also passed to pub/sub; this value is required to update the job.
 * After successful publishing, a job is created in the database.
 */
export async function action(args: Route.ActionArgs) {
  const ctx = await withContext(args);
  // TODO: scope aware jobs at this level?
  if (!ctx.user) throw error401('Unauthorized - jobs must be created on behalf of a user');
  const body = await ensureJsonBodyFromMethod(args.request, ['POST']);
  const schema = await createJobPostBodySchema(extensions);
  const { id, job_type, payload, results } = validate(schema, body);
  const dto = await jobs.create(
    ctx,
    { payload, job_type, id: id ?? uuidv7(), results },
    registerExtensionJobs(extensions),
  );
  return Response.json(dto, { status: 201 });
}
