import type { Context } from '../../../context.server.js';
import { SiteContext } from '../../../context.site.server.js';
import type { ClientExtension } from '@curvenote/scms-core';
import { error401, error404, work } from '@curvenote/scms-core';
import { dbListSubmissions, formatSubmissionItemDTO } from '../../sites/submissions/list.server.js';
import { userHasWorkScope } from '../../../scopes.helpers.server.js';

export async function dbListUserSubmissions(
  userId: string,
  opts: { key?: string; workId?: string; siteName?: string; includeDrafts?: boolean } = {},
) {
  return dbListSubmissions(
    {
      ...(opts.siteName ? { site: { name: opts.siteName } } : {}),
      work: {
        ...(opts.key ? { key: opts.key } : {}),
        ...(opts.workId ? { id: opts.workId } : {}),
        work_users: {
          some: {
            user_id: userId,
          },
        },
      },
    },
    undefined,
    undefined,
    { includeDraftOnlySubmissions: opts.includeDrafts },
  );
}

type DBO = Exclude<Awaited<ReturnType<typeof dbListUserSubmissions>>, null>;

export async function formatMySubmissionListDTO(
  ctx: Context,
  dbo: DBO,
  extensions: ClientExtension[],
  siteCtxCache: Record<string, SiteContext>,
  opts?: { key?: string; workId?: string; siteName?: string },
) {
  const items = await Promise.all(
    dbo.map(async (submission) => {
      if (!siteCtxCache[submission.site.name]) {
        siteCtxCache[submission.site.name] = new SiteContext(ctx, submission.site);
      }
      return formatSubmissionItemDTO(siteCtxCache[submission.site.name], submission, extensions);
    }),
  );
  const params = new URLSearchParams();
  if (opts?.key) params.set('key', opts.key);
  if (opts?.workId) params.set('work_id', opts.workId);
  if (opts?.siteName) params.set('site', opts.siteName);
  const selfQuery = params.toString() ? `?${params.toString()}` : '';
  return {
    items,
    links: {
      self: ctx.asApiUrl(`/my/submissions${selfQuery}`),
    },
  };
}

/**
 * Returns all submissions associated with works where user has submission access
 */
export default async function (
  ctx: Context,
  extensions: ClientExtension[],
  opts?: string | { key?: string; workId?: string; siteName?: string; includeDrafts?: boolean },
) {
  if (!ctx.user) throw error401();
  const normalized =
    typeof opts === 'string'
      ? { key: opts }
      : {
          key: opts?.key,
          workId: opts?.workId,
          siteName: opts?.siteName,
          includeDrafts: opts?.includeDrafts,
        };
  const dbo = await dbListUserSubmissions(ctx.user.id, normalized);
  if (!dbo) throw error404();
  const siteCtxCache: Record<string, SiteContext> = {};
  const filteredDbo = dbo.filter((submission) => {
    return userHasWorkScope(ctx.user, work.id.submissions.list, submission.work_id);
  });
  return formatMySubmissionListDTO(ctx, filteredDbo, extensions, siteCtxCache, normalized);
}
