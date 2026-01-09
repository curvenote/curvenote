import type { Route } from './+types/v1.sites.$siteName.kinds';
import { withSecureSiteContext, sites } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureSiteContext(args);
  const dto = await sites.kinds.list(ctx);
  return Response.json(dto);
}
