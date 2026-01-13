import type { Route } from './+types/v1.my.works.$workId';
import { httpError } from '@curvenote/scms-core';
import { withAPISecureContext, works } from '@curvenote/scms-server';

/**
 * This should be deprecated in favor of `/v1/works/$workId`
 *
 * I should be able to access my works through that endpoint.
 * The links from `/v1/my/works` already point there.
 */
export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAPISecureContext(args);
  const { workId } = args.params;
  if (!workId) return httpError(400, 'Missing workId');
  const dto = await works.get(ctx, workId);
  return Response.json(dto);
}
