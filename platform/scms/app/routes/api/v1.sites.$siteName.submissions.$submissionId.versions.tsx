import type { Route } from './+types/v1.sites.$siteName.submissions.$submissionId.versions';
import { z } from 'zod';
import { httpError, site, work } from '@curvenote/scms-core';
import {
  ensureJsonBodyFromMethod,
  validate,
  withScopedSubmissionContext,
  withSecureSiteContext,
  sites,
  works,
} from '@curvenote/scms-server';
import { extensions } from '../../extensions/server';

const CreateSubmissionVersionPostBodySchema = z.object({
  work_version_id: z.uuid(),
  job_id: z.uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string().min(1).max(255)).max(64).optional(),
});

const ParamsSchema = z.object({
  limit: z.number().int().min(1).max(500).default(500),
  page: z.number().int().min(0).optional(),
});

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureSiteContext(args);
  if (ctx.site.external) {
    throw httpError(405, 'External sites do not accept submissions');
  }

  const submissionId = args.params.submissionId;
  if (!submissionId) throw httpError(400, 'Missing submission id');

  const submission = await sites.submissions.dbGetSubmission({ id: submissionId });
  if (!submission || submission.site.name !== ctx.site.name) {
    throw httpError(404, 'Submission not found');
  }

  const params = new URL(ctx.request.url).searchParams;
  const { limit, page } = validate(ParamsSchema, {
    limit: params.get('limit') ? parseInt(params.get('limit')!) : undefined,
    page: params.get('page') ? parseInt(params.get('page')!) : undefined,
  });
  const dto = await sites.submissions.versions.list(ctx, submissionId, { page, limit });
  return Response.json(dto);
}

/**
 * POST a new version of a submission
 */
export async function action(args: Route.ActionArgs) {
  const ctx = await withScopedSubmissionContext(args, [
    site.submissions.versions.create,
    work.id.submissions.versions.create,
  ]);
  if (args.request.method !== 'POST') {
    throw httpError(405, 'Method Not Allowed');
  }
  const body = await ensureJsonBodyFromMethod(args.request, ['POST']);
  const { work_version_id, job_id, metadata, tags } = validate(
    CreateSubmissionVersionPostBodySchema,
    body,
  );
  // Ensure new work version is on the same work as previous submissions
  const workVersion = await works.versions.dbGetWorkVersion(ctx.work.id, work_version_id);
  if (!workVersion) {
    throw httpError(
      400,
      `work version ${work_version_id} not found on work associated with submission`,
    );
  }
  const dto = await sites.submissions.versions.create(
    ctx,
    extensions,
    ctx.submission.id,
    work_version_id,
    job_id,
    metadata,
    tags,
  );
  return Response.json(dto, { status: 201 });
}
