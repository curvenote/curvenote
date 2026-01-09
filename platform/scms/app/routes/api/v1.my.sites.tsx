import type { Route } from './+types/v1.my.sites';
import { withAPISecureContext, my } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAPISecureContext(args);
  const dto = await my.sites(ctx);
  return Response.json(dto);
}
