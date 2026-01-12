import type { Route } from './+types/v1.works.$workId.thumbnail';
import * as cdnlib from '@curvenote/cdn';
import { error404, work } from '@curvenote/scms-core';
import { withSecureWorkContext, sortSignedUrlQuery } from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureWorkContext(args, [work.read]);
  const query = sortSignedUrlQuery(args.request.url);
  const { cdn, cdn_key } = ctx.workDTO;
  if (!cdn || !cdn_key) throw error404();
  const location = await cdnlib.getCdnLocation({ cdn, key: cdn_key });
  const thumbnail = await cdnlib.getThumbnailBuffer({
    ...location,
    query,
  });
  return new Response(thumbnail, {
    headers: {
      'Cache-Control': 'max-age=3600',
    },
  });
}
