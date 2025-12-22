import type { Route } from './+types/v1.sites.$siteName.collections';
import { withSecureSiteContext, sites } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureSiteContext(args);
  const searchParams = new URL(ctx.request.url).searchParams;
  const openParam = searchParams.get('open');
  const open = openParam === 'true' ? true : openParam === 'false' ? false : undefined;
  const dto = await sites.collections.list(ctx, { open });
  return Response.json(dto);
}
