import { uuidv7 as uuid } from 'uuidv7';
import { getCdnLocation, getCdnBaseUrl, getPage, getConfig } from '@curvenote/cdn';
import { formatDate } from '@curvenote/common';
import type { HostSpec } from '@curvenote/common';
import type { Context } from '../../context.server.js';
import type {
  CreateWorkVersion,
  MystWorkVersion,
  UserDBO,
  WorkDBO,
  WorkVersionDBO,
} from '../../db.types.js';
import { getPrismaClient } from '../../prisma.server.js';
import { getSignedCDNQuery } from '../../sign.private.server.js';
import { error401, ensureTrailingSlash, WorkContents, TrackEvent } from '@curvenote/scms-core';
import { formatWorkDTO } from './get.server.js';
import { ActivityType, WorkRole } from '@prisma/client';
import type { Prisma } from '@prisma/client';

type PageLoader = NonNullable<Awaited<ReturnType<typeof getPage>>>;

/**
 * Fetches the config.json file from the CDN and uses it to identify the
 * index page for the given project. Then fetches that page and parses it.
 * Information in the frontmatter section of the page is used to populate
 * the data fields on a WorkVersion object.
 *
 * @param cdn
 * @param key
 */
export async function getCreateWorkVersionDataFromMyst(
  ctx: Context,
  host: HostSpec,
  opts?: { canonical?: boolean },
) {
  try {
    const location = await getCdnLocation(host);
    const baseUrl = await getCdnBaseUrl(location);
    let query;
    if (ctx.privateCdnUrls().has(ensureTrailingSlash(location.cdn))) {
      query = getSignedCDNQuery(ctx, baseUrl);
    }
    console.info(`query: ${query}`);

    const config = await getConfig({ ...location, query });
    const project = config?.projects?.[0];
    const page: PageLoader | null = await getPage({ ...location, query }, { loadIndexPage: true });
    if (!page) {
      console.error('Could not create Work - no article', JSON.stringify({ ...location, query }));
      throw new Response('Article was not found.', {
        status: 422,
        statusText: `Could not create Work - Article was not found.`,
      });
    }

    // for submissions we prioritize the project frontmatter over the page frontmatter
    const authorDetails = project?.authors ?? page.frontmatter?.authors ?? [];
    const authorNames = authorDetails.map((a) => a.name ?? '');
    const data: MystWorkVersion = {
      cdn: host.cdn,
      cdn_key: host.key,
      title: project?.title ?? page.frontmatter.title ?? 'Untitled',
      description: project?.description ?? page.frontmatter.description ?? '',
      authors: authorNames,
      author_details: authorDetails,
      date: project?.date
        ? formatDate(project.date)
        : page.frontmatter.date
          ? formatDate(page.frontmatter.date)
          : null,
      doi: project?.doi ? project.doi : (page.frontmatter.doi ?? ''),
      canonical: opts?.canonical ?? false,
    };
    return data;
  } catch (error: any) {
    console.error(error);
    throw new Response(error.statusText, {
      status: 422,
      statusText: `Could not create Work - ${error.statusText}.`,
    });
  }
}

export async function dbCreateWorkAndVersion(
  owner: UserDBO,
  data: CreateWorkVersion,
  key?: string,
  contains: string[] = [WorkContents.MYST],
): Promise<WorkDBO & { versions: WorkVersionDBO[] }> {
  const date_created = formatDate();
  const prisma = await getPrismaClient();
  const workId = uuid();
  const workVersionId = uuid();
  return prisma.$transaction(async (tx) => {
    const work = await tx.work.create({
      data: {
        date_created,
        date_modified: date_created,
        id: workId,
        key,
        contains,
        created_by: {
          connect: {
            id: owner.id,
          },
        },
        versions: {
          create: [
            {
              id: workVersionId,
              date_created,
              date_modified: date_created,
              cdn: data.cdn,
              cdn_key: data.cdn_key,
              title: data.title,
              description: data.description ?? null,
              authors: data.authors,
              author_details: data.author_details,
              date: data.date ?? null,
              doi: data.doi ?? null,
              canonical: data.canonical ?? null,
            } as Prisma.WorkVersionCreateInput,
          ],
        },
        work_users: {
          create: [
            {
              id: uuid(),
              date_created,
              date_modified: date_created,
              user: {
                connect: {
                  id: owner.id,
                },
              },
              role: WorkRole.OWNER,
            },
          ],
        },
      },
      include: {
        versions: true,
        created_by: true,
        work_users: true,
      },
    });

    await tx.activity.create({
      data: {
        id: uuid(),
        date_created,
        date_modified: date_created,
        activity_by: {
          connect: {
            id: owner.id,
          },
        },
        activity_type: ActivityType.NEW_WORK,
        work: {
          connect: {
            id: workId,
          },
        },
        work_version: {
          connect: {
            id: workVersionId,
          },
        },
      },
    });

    return work;
  });
}

export default async function (ctx: Context, cdn: string, cdn_key: string, key?: string) {
  if (!ctx.user) throw error401();
  cdn = cdn.endsWith('/') ? cdn : `${cdn}/`;
  const data = await getCreateWorkVersionDataFromMyst(
    ctx,
    { cdn, key: cdn_key },
    { canonical: true },
  );
  const work = await dbCreateWorkAndVersion(ctx.user, data, key);

  // Track work creation analytics
  await ctx.trackEvent(TrackEvent.WORK_CREATED, {
    workId: work.id,
    workVersionId: work.versions[0].id,
    title: data.title,
    description: data.description,
    authorCount: data.authors?.length || 0,
    draft: false,
    hasKey: !!key,
    contains: work.contains,
  });

  await ctx.analytics.flush();

  const dto = formatWorkDTO(ctx, work, work.versions[0]);
  return dto;
}
