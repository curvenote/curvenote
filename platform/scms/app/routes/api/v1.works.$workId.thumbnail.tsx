import type { Route } from './+types/v1.works.$workId.thumbnail';
import { error404, work } from '@curvenote/scms-core';
import {
  withSecureWorkContext,
  sortSignedUrlQuery,
  works,
  resolveWorkVersionThumbnail,
} from '@curvenote/scms-server';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withSecureWorkContext(args, [work.id.read]);
  const query = sortSignedUrlQuery(args.request.url);
  const version = works.getCanonicalOrLatestVersion(ctx.work.versions ?? []);
  if (!version?.cdn || (!version.cdn_key && !version.thumbnail)) throw error404();
  const thumbnail = await resolveWorkVersionThumbnail(ctx, version, { query });
  if (!thumbnail) throw error404();
  return new Response(thumbnail, {
    headers: {
      'Cache-Control': 'max-age=3600',
    },
  });
}
