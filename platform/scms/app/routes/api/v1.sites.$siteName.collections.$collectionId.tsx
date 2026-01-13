import type { Route } from './+types/v1.sites.$siteName.collections.$collectionId';
import { httpError } from '@curvenote/scms-core';
import { withSecureSiteContext, sites } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureSiteContext(args);
  const { collectionId } = args.params;
  if (!collectionId) throw httpError(400, 'Missing collectionId');
  const dto = await sites.collections.get(ctx, { id: collectionId });
  return Response.json(dto);
}
