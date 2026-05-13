import type { Route } from './+types/v1.my.submissions';
import { withAPISecureContext, my } from '@curvenote/scms-server';
import { extensions } from '../../extensions/server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAPISecureContext(args);
  const url = new URL(args.request.url);
  const key = url.searchParams.get('key');
  const workId = url.searchParams.get('work_id');
  const site = url.searchParams.get('site') ?? url.searchParams.get('site_name');
  const dto = await my.submissions.list(ctx, extensions, {
    key: key ?? undefined,
    workId: workId ?? undefined,
    siteName: site ?? undefined,
  });
  return Response.json(dto);
}
