import type { Route } from './+types/v1.jobs';
import { z } from 'zod';
import type { ClientExtension, ServerExtension } from '@curvenote/scms-core';
import { error401, error405, createFollowOnSchemas, KnownJobTypes } from '@curvenote/scms-core';
import {
  ensureJsonBodyFromMethod,
  jobs,
  withContext,
  validate,
  registerExtensionJobs,
} from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';
import { extensions } from '../../extensions/server';

async function getJobTypes(extensions: ServerExtension[]): Promise<readonly string[]> {
  const coreJobTypes = [
    KnownJobTypes.CHECK,
    KnownJobTypes.CLI_CHECK,
    KnownJobTypes.PUBLISH,
    KnownJobTypes.UNPUBLISH,
    KnownJobTypes.CONVERTER_TASK,
  ];
  const extensionJobTypes = registerExtensionJobs(extensions).map((job) => job.jobType);
  return [...coreJobTypes, ...extensionJobTypes] as const;
}

async function createJobPostBodySchema(extensions: ClientExtension[]) {
  const JOB_TYPES = await getJobTypes(extensions);
  const { FollowOnSchema } = createFollowOnSchemas(JOB_TYPES);
  return z.object({
    id: z.uuid().optional(),
    job_type: z
      .enum(JOB_TYPES as [string, ...string[]], {
        error: () => `job_type must be ${JOB_TYPES.join(', ')} (case sensitive)`,
      })
      .default('CHECK'),
    payload: z.record(z.string().min(0), z.any(), {
      error: (issue) => (issue.input === undefined ? 'a payload object is required' : undefined),
    }),
    results: z
      .record(z.string().min(0), z.any(), {
        error: (issue) => (issue.code === 'invalid_type' ? 'results must be an object' : undefined),
      })
      .optional(),
    follow_on: FollowOnSchema.optional(),
    activity_type: z.string().optional(),
    activity_data: z.record(z.string().min(0), z.any()).optional(),
  });
}

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
  const { id, job_type, payload, results, follow_on, activity_type, activity_data } = validate(
    schema,
    body,
  );
  const dto = await jobs.invoke(
    ctx,
    {
      payload,
      job_type,
      id: id ?? uuidv7(),
      results,
      follow_on,
      invoked_by_id: ctx.user?.id,
      activity_type,
      activity_data,
    },
    registerExtensionJobs(extensions),
  );
  return Response.json(dto, { status: 201 });
}
