import type { Route } from './+types/v1.sites.$siteName.works.$workIdOrSlug.published';
import { httpError } from '@curvenote/scms-core';
import { withSecureSiteContext, sites } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureSiteContext(args);
  const { workIdOrSlug } = args.params;
  if (!workIdOrSlug) throw httpError(400, 'Missing workId or slug');
  const dto = await sites.submissions.published.get(ctx, workIdOrSlug);
  // redirect if not primary slug
  return Response.json(dto);
}
