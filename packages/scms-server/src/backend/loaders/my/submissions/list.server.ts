import type { Prisma } from '@curvenote/scms-db';
import type { Context } from '../../../context.server.js';
import { SiteContext } from '../../../context.site.server.js';
import type { ClientExtension } from '@curvenote/scms-core';
import { error401, error404, work } from '@curvenote/scms-core';
import { dbListSubmissions, formatSubmissionItemDTO } from '../../sites/submissions/list.server.js';
import { userHasWorkScope } from '../../../scopes.helpers.server.js';

export async function dbListUserSubmissions(userId: string, key?: string) {
  return dbListSubmissions({
    work: {
      key,
      work_users: {
        some: {
          user_id: userId,
        },
      },
    },
  });
}

type DBO = Exclude<Awaited<ReturnType<typeof dbListUserSubmissions>>, null>;

export async function formatMySubmissionListDTO(
  ctx: Context,
  dbo: DBO,
  extensions: ClientExtension[],
  siteCtxCache: Record<string, SiteContext>,
) {
  const items = await Promise.all(
    dbo.map(async (submission) => {
      if (!siteCtxCache[submission.site.name]) {
        siteCtxCache[submission.site.name] = new SiteContext(ctx, submission.site);
      }
      return formatSubmissionItemDTO(siteCtxCache[submission.site.name], submission, extensions);
    }),
  );
  return {
    items,
    links: {
      self: ctx.asApiUrl('/my/submissions'),
    },
  };
}

/**
 * Returns all submissions associated with works where user has submission access
 */
export default async function (ctx: Context, extensions: ClientExtension[], key?: string) {
  if (!ctx.user) throw error401();
  const dbo = await dbListUserSubmissions(ctx.user.id, key);
  if (!dbo) throw error404();
  const siteCtxCache: Record<string, SiteContext> = {};
  const filteredDbo = dbo.filter((submission) => {
    return userHasWorkScope(ctx.user, work.submissions.list, submission.work_id);
  });
  return formatMySubmissionListDTO(ctx, filteredDbo, extensions, siteCtxCache);
}
