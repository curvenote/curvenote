import type { Route } from './+types/v1.my.works';
import { withAPISecureContext, my } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAPISecureContext(args);
  const url = new URL(args.request.url);
  const key = url.searchParams.get('key');
  const where = key ? { key } : {};
  const dto = await my.works.list(ctx, where);
  return Response.json(dto);
}
