import type { Route } from './+types/v1.jobs';
import { z } from 'zod';
import type { ClientExtension, ServerExtension } from '@curvenote/scms-core';
import { error401, error405, httpError, KnownJobTypes } from '@curvenote/scms-core';
import { JobStatus } from '@curvenote/scms-db';
import {
  ensureJsonBodyFromMethod,
  withContext,
  validate,
  registerExtensionJobs,
  enqueueAndDispatchJob,
} from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';
import { extensions } from '../../extensions/server';

async function getJobTypes(exts: ServerExtension[]): Promise<readonly string[]> {
  const coreJobTypes = [
    KnownJobTypes.CHECK,
    KnownJobTypes.CLI_CHECK,
    KnownJobTypes.PUBLISH,
    KnownJobTypes.UNPUBLISH,
    KnownJobTypes.CONVERTER_TASK,
  ];
  const extensionJobTypes = registerExtensionJobs(exts).map((job) => job.jobType);
  return [...coreJobTypes, ...extensionJobTypes] as const;
}

async function createJobPostBodySchema(exts: ClientExtension[]) {
  const JOB_TYPES = await getJobTypes(exts);
  return z
    .object({
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
          error: (issue) =>
            issue.code === 'invalid_type' ? 'results must be an object' : undefined,
        })
        .optional(),
      activity_type: z.string().optional(),
      activity_data: z.record(z.string().min(0), z.any()).optional(),
    })
    .strict();
}

function rejectLegacyFollowOn(body: unknown): void {
  if (body != null && typeof body === 'object' && 'follow_on' in body) {
    throw httpError(
      400,
      'follow_on is no longer supported on POST /v1/jobs. Configure job chains server-side via enqueueAndDispatchJob({ dependents: [...] }).',
    );
  }
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
  rejectLegacyFollowOn(body);
  const schema = await createJobPostBodySchema(extensions);
  const { id, job_type, payload, activity_type, activity_data, results } = validate(schema, body);

  const jobId = id ?? uuidv7();
  const result = await enqueueAndDispatchJob({
    job_id: jobId,
    job_type,
    payload,
    invoked_by_id: ctx.user?.id,
    activity_type,
    activity_data,
    results,
  });

  const responseStatus = job_type === KnownJobTypes.CLI_CHECK ? JobStatus.QUEUED : result.status;

  return Response.json(
    {
      id: result.job_id,
      job_id: result.job_id,
      job_type: result.job_type,
      status: responseStatus,
      results: results ?? undefined,
      dependent_job_ids: result.dependent_job_ids,
    },
    { status: 201 },
  );
}
