import type { Route } from './+types/v1.sites.$siteName.doi.$first.$second';
import { httpError } from '@curvenote/scms-core';
import { withSecureSiteContext, sites } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureSiteContext(args);
  const { first, second } = args.params;
  if (!first || !second) throw httpError(400, 'Malformed DOI params');
  const doiLookup = `${first}/${second}`;
  const dto = await sites.doi(ctx, doiLookup);
  return Response.json(dto);
}
