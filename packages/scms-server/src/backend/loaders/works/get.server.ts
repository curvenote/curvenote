import { doi } from 'doi-utils';
import { formatDate, type WorkDTO } from '@curvenote/common';
import type { Context } from '../../context.server.js';
import type { UserDBO, WorkVersionDBO, WorkDBO } from '../../db.types.js';
import { formatAuthorDTO } from '../../format.server.js';
import { getPrismaClient } from '../../prisma.server.js';
import { error401, error404, site } from '@curvenote/scms-core';
import { dbGetSubmission } from '../sites/submissions/get.server.js';
import { signPrivateUrls } from '../../sign.private.server.js';
import type { WorkRole } from '@prisma/client';
import { userHasSiteScope } from '../../scopes.helpers.server.js';

export type WorkAndVersionsDBO = WorkDBO & { versions?: WorkVersionDBO[] };
export type WorkUserDBO = { work_id: string; user_id: string; role: WorkRole };
export type UserWithWorkRolesDBO = UserDBO & { work_roles: WorkUserDBO[] };

export function formatWorkDTO(
  ctx: Context,
  work: WorkDBO,
  version?: WorkVersionDBO,
  submissionId?: string,
): WorkDTO {
  const query = submissionId ? `?submission=${submissionId}` : '';
  if (!version) {
    return {
      id: work.id,
      key: work.key ?? undefined,
      date_created: formatDate(work.date_created),
      links: {
        self: `${ctx.asApiUrl(`/works/${work.id}`)}${query}`,
        versions: `${ctx.asApiUrl(`/works/${work.id}/versions`)}${query}`,
      },
    };
  }

  let thumbnail: string | undefined;
  if (version.cdn && version.cdn_key) {
    const { thumbnail: thumbnailUrl } = signPrivateUrls(
      ctx,
      { cdn: version.cdn, key: version.cdn_key },
      ctx.asApiUrl(`/works/${work.id}/thumbnail`),
      'no-social',
    );
    thumbnail = thumbnailUrl;
  }
  return {
    id: work.id,
    version_id: version.id,
    key: work.key ?? undefined,
    cdn: version.cdn ?? undefined,
    cdn_key: version.cdn_key ?? undefined,
    date_created: formatDate(version.date_created),
    title: version.title ?? '',
    description: version.description || undefined,
    authors: version.authors.map((a) => formatAuthorDTO(a)),
    date: version.date ? formatDate(version.date) : undefined,
    canonical: version.canonical ?? undefined,
    links: {
      self: `${ctx.asApiUrl(`/works/${work.id}`)}${query}`,
      versions: `${ctx.asApiUrl(`/works/${work.id}/versions`)}${query}`,
      doi: version.doi ? doi.buildUrl(version.doi) : undefined,
      config: `${version.cdn}${work.id.replace(/\./g, '/')}/config.json`,
      thumbnail,
    },
  };
}

/**
 * Flatten the work and a version into a single object.
 * If no version is marked as canonical, the latest version is used.
 *
 * @param work
 * @param sortedVersions - assumed already sorted by date_created
 * @returns A WorkWithFlatVersion object
 */
export function getCanonicalOrLatestVersion(
  sortedVersions: WorkVersionDBO[],
): WorkVersionDBO | undefined {
  let version = sortedVersions.find((v) => v.canonical);
  if (!version) version = sortedVersions[0];
  return version;
}

export async function dbGetWorkForUser(
  user: UserDBO,
  workId: string,
): Promise<WorkAndVersionsDBO | null> {
  const prisma = await getPrismaClient();
  const work = await prisma.work.findUnique({
    where: {
      id: workId,
      work_users: {
        some: {
          user_id: user.id,
        },
      },
    },
    include: {
      versions: {
        orderBy: {
          date_created: 'desc',
        },
      },
    },
  });

  return work;
}

export async function dbGetWork(workId: string): Promise<WorkAndVersionsDBO | null> {
  const prisma = await getPrismaClient();
  const work = await prisma.work.findUnique({
    where: {
      id: workId,
    },
    include: {
      versions: {
        orderBy: {
          date_created: 'desc',
        },
      },
    },
  });

  return work;
}

export async function dbGetUserWorkRoles(userId: string, workId: string): Promise<WorkUserDBO[]> {
  const prisma = await getPrismaClient();
  const workUsers = await prisma.workUser.findMany({
    where: {
      user_id: userId,
      work_id: workId,
    },
  });
  return workUsers;
}

export async function getWorkFromSubmission(
  ctx: Context,
  workId: string,
  submissionId: string,
  scope: string,
) {
  const submission = await dbGetSubmission({ id: submissionId });
  // Submission must exist
  if (!submission) throw error404();
  // User must have access to submission via the site; throw if they do not
  if (!userHasSiteScope(ctx.user, scope, submission.site_id)) throw error404();
  const work = submission.work;
  // Work ID must be correct
  if (work?.id !== workId) throw error404();
  const workVersion = submission.versions[0]?.work_version;
  return { work, workVersion };
}

export default async function (ctx: Context, workId: string, submissionId?: string) {
  if (!ctx.user) throw error401();
  // Review team/private site access
  let workVersion: WorkVersionDBO | undefined;
  // Get work if current user created the work
  let work: WorkAndVersionsDBO | null | undefined = await dbGetWorkForUser(ctx.user, workId);
  if (work && work.versions) {
    workVersion = getCanonicalOrLatestVersion(work.versions);
  }
  if (!work && submissionId) {
    // Get work via submission if current user has a role that can update the submission
    ({ work, workVersion } = await getWorkFromSubmission(
      ctx,
      workId,
      submissionId,
      site.submissions.read,
    ));
  }
  if (!work) throw error404();
  return formatWorkDTO(ctx, work, workVersion, submissionId);
}
