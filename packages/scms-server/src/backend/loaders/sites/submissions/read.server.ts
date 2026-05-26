import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import type { Prisma } from '@curvenote/scms-db';
import { error401, error403, error404, httpError } from '@curvenote/scms-core';
import { withContext } from '../../../context.server.js';
import { SiteContextWithUser } from '../../../context.site.server.js';
import { dbGetSite, dbGetUserSiteRoles } from '../get.server.js';
import { getPrismaClient } from '../../../prisma.server.js';
import { dbGetUserWorkRoles } from '../../works/get.server.js';
import { userHasSiteScope, userHasWorkScope } from '../../../scopes.helpers.server.js';

const submissionReadRefSelect = {
  id: true,
  work_id: true,
  site: { select: { id: true, private: true, restricted: true } },
  versions: {
    select: { work_version: { select: { work_id: true } } },
    orderBy: { date_created: 'desc' as const },
    take: 1,
  },
} satisfies Prisma.SubmissionSelect;

export type SubmissionReadRef = Prisma.SubmissionGetPayload<{
  select: typeof submissionReadRefSelect;
}>;

export async function dbGetSubmissionReadRef(siteName: string, submissionId: string) {
  const prisma = await getPrismaClient();
  return prisma.submission.findFirst({
    where: {
      id: submissionId,
      site: { name: siteName },
    },
    select: submissionReadRefSelect,
  });
}

export function resolveSubmissionWorkId(ref: SubmissionReadRef): string | undefined {
  return ref.work_id ?? ref.versions[0]?.work_version?.work_id ?? undefined;
}

/**
 * Verifies the submission exists on the site and the user has read access via work or site scopes.
 * Does not load the full submission graph.
 */
export async function assertSubmissionReadAccess(
  ctx: SiteContextWithUser,
  submissionId: string,
  scopes: string[],
) {
  const ref = await dbGetSubmissionReadRef(ctx.site.name, submissionId);
  if (!ref) throw error404();

  const workId = resolveSubmissionWorkId(ref);
  if (!workId) throw error404();

  let userAccess = false;

  if (!ctx.site.private && !ctx.site.restricted) {
    const workRoles = await dbGetUserWorkRoles(ctx.user.id, workId);
    const user = { ...ctx.user, work_roles: workRoles };
    userAccess = scopes.some((scope) => userHasWorkScope(user, scope, workId));
  }

  if (!userAccess) {
    const siteRoles = await dbGetUserSiteRoles(ctx.user.id, ctx.site.id);
    const user = { ...ctx.user, site_roles: siteRoles };
    userAccess = scopes.some((scope) => userHasSiteScope(user, scope, ctx.site.id));
  }

  if (!userAccess) {
    throw error403();
  }

  return ref;
}

/**
 * Site context for authenticated Curvenote API reads on a single submission.
 * Lighter than withCurvenoteSubmissionContext — no full submission/work load.
 */
export async function withCurvenoteSubmissionReadSiteContext<
  T extends LoaderFunctionArgs | ActionFunctionArgs,
>(args: T, scopes: string[]): Promise<SiteContextWithUser> {
  const ctx = await withContext(args);

  if (!ctx.user) throw error401();
  if (!ctx.authorized.curvenote) throw error401();

  const { siteName, submissionId } = args.params;
  if (!siteName) throw httpError(400, 'Missing site name');
  if (!submissionId) throw httpError(400, 'Missing submission ID');

  const site = await dbGetSite(siteName);
  if (!site?.metadata) throw error404();

  const siteCtx = new SiteContextWithUser(ctx, site);
  await assertSubmissionReadAccess(siteCtx, submissionId, scopes);
  return siteCtx;
}
