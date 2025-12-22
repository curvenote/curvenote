import type { Route } from './+types/v1.my.user';
import { withAPISecureContext } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAPISecureContext(args);
  return Response.json(ctx.user);
}
