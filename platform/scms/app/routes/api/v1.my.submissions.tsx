import type { Route } from './+types/v1.my.submissions';
import { withAPISecureContext, my } from '@curvenote/scms-server';
import { extensions } from '../../extensions/server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAPISecureContext(args);
  const url = new URL(args.request.url);
  const key = url.searchParams.get('key');
  const dto = await my.submissions.list(ctx, extensions, key ?? undefined);
  return Response.json(dto);
}
