import { uuidv7 as uuid } from 'uuidv7';
import { formatDate } from '@curvenote/common';
import type { Context } from '../../../context.server.js';
import type { CreateWorkVersion } from '../../../db.types.js';
import { getPrismaClient } from '../../../prisma.server.js';
import { error401, error404, site } from '@curvenote/scms-core';
import { dbGetWorkForUser, formatWorkDTO, getWorkFromSubmission } from '../get.server.js';
import { getCreateWorkVersionDataFromMyst } from '../create.server.js';
import { $Enums } from '@curvenote/scms-db';

export async function dbCreateWorkVersionAndUpdateWork(
  workId: string,
  data: CreateWorkVersion,
  userId: string,
) {
  const date_created = formatDate();
  const prisma = await getPrismaClient();
  const workVersionId = uuid();
  return prisma.$transaction(async (tx) => {
    const work = await tx.work.update({
      where: { id: workId },
      data: {
        date_modified: date_created,
        versions: {
          create: [
            {
              id: workVersionId,
              date_created,
              date_modified: date_created,
              cdn_key: data.cdn_key,
              cdn: data.cdn,
              title: data.title ?? 'Untitled',
              description: data.description,
              authors: data.authors ?? [],
              author_details: data.author_details,
              date: data.date,
              doi: data.doi,
              canonical: data.canonical,
            },
          ],
        },
      },
      include: {
        versions: {
          // include the latest version only
          orderBy: {
            date_created: 'desc',
          },
          take: 1,
        },
      },
    });
    await tx.activity.create({
      data: {
        id: uuid(),
        date_created,
        date_modified: date_created,
        activity_type: $Enums.ActivityType.WORK_VERSION_ADDED,
        activity_by: {
          connect: {
            id: userId,
          },
        },
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

export default async function (
  ctx: Context,
  workId: string,
  data: CreateWorkVersion,
  submissionId?: string,
) {
  if (!ctx.user) throw error401();
  let existingWork = await dbGetWorkForUser(ctx.user, workId);
  if (!existingWork && submissionId) {
    // Get existing work via submission permissions; throw if access denied
    ({ work: existingWork } = await getWorkFromSubmission(
      ctx,
      workId,
      submissionId,
      site.submissions.versions.create,
    ));
  }
  if (!existingWork) throw error404();

  let mergedData = data;
  if (data.cdn && data.cdn_key) {
    const mystData = await getCreateWorkVersionDataFromMyst(
      ctx,
      { cdn: data.cdn, key: data.cdn_key },
      {
        canonical: true,
      },
    );
    mergedData = { ...data, ...mystData };
  }

  mergedData.cdn = mergedData.cdn
    ? mergedData.cdn?.endsWith('/')
      ? mergedData.cdn
      : `${mergedData.cdn}/`
    : undefined;

  const work = await dbCreateWorkVersionAndUpdateWork(workId, mergedData, ctx.user.id);
  const dto = formatWorkDTO(ctx, work, work.versions[0], submissionId);
  return dto;
}
