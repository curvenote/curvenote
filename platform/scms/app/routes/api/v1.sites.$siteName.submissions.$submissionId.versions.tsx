import type { Route } from './+types/v1.sites.$siteName.submissions.$submissionId.versions';
import { z } from 'zod';
import { httpError, site, work } from '@curvenote/scms-core';
import {
  ensureJsonBodyFromMethod,
  validate,
  CreateSubmissionVersionPostBodySchema,
  withCurvenoteSubmissionContext,
  withScopedSubmissionContext,
  sites,
  works,
} from '@curvenote/scms-server';
import { extensions } from '../../extensions/server';

const ParamsSchema = z.object({
  limit: z.number().int().min(1).max(500).default(500),
  page: z.number().int().min(0).optional(),
});

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withCurvenoteSubmissionContext(args, [
    work.submissions.list,
    site.submissions.list,
  ]);
  const params = new URL(ctx.request.url).searchParams;
  const { limit, page } = validate(ParamsSchema, {
    limit: params.get('limit') ? parseInt(params.get('limit')!) : undefined,
    page: params.get('page') ? parseInt(params.get('page')!) : undefined,
  });
  const dto = await sites.submissions.versions.list(ctx, ctx.submission.id, { page, limit });
  return Response.json(dto);
}

/**
 * POST a new version of a submission
 */
export async function action(args: Route.ActionArgs) {
  const ctx = await withScopedSubmissionContext(args, [
    site.submissions.versions.create,
    work.submissions.versions.create,
  ]);
  if (args.request.method !== 'POST') {
    throw httpError(405, 'Method Not Allowed');
  }
  const body = await ensureJsonBodyFromMethod(args.request, ['POST']);
  const { work_version_id, job_id } = validate(CreateSubmissionVersionPostBodySchema, body);
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
  );
  return Response.json(dto, { status: 201 });
}
