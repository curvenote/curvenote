import type { Route } from './+types/v1.works.$workId';
import { work, httpError, error404 } from '@curvenote/scms-core';
import {
  ensureJsonBodyFromMethod,
  UpdateWorkPatchBodySchema,
  validate,
  withAPISecureContext,
  withCurvenoteWorkContext,
  works,
} from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  // TODO: Update this to use withAPIWorkContext when we no longer
  //       need submission query parameter backdoor to load works
  const ctx = await withAPISecureContext(args);
  const { workId } = args.params;
  if (!workId) return httpError(400, 'Missing workId');
  const { url } = args.request;
  const query = new URL(url).search.slice(1);
  const searchParams = new URLSearchParams(query);
  const submission = searchParams.get('submission') ?? undefined;
  const dto = await works.get(ctx, workId, submission);
  return Response.json(dto);
}

/**
 * PATCH v1/works/id to add key
 *
 * This is only used to add a key if none exists. You cannot update
 * an existing key.
 */
export async function action(args: Route.ActionArgs) {
  const ctx = await withCurvenoteWorkContext(args, [work.update]);
  if (args.request.method === 'PATCH') {
    const body = await ensureJsonBodyFromMethod(args.request, ['PATCH']);
    const { key } = validate(UpdateWorkPatchBodySchema, body);
    const dto = await works.update(ctx, ctx.work.id, key);
    return Response.json(dto);
  }
  throw error404();
}
