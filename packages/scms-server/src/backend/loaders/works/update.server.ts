import type { Context } from '../../context.server.js';
import type { UserDBO } from '../../db.types.js';
import { getPrismaClient } from '../../prisma.server.js';
import { error401, error404, httpError } from '@curvenote/scms-core';
import { dbGetWorkForUser, formatWorkDTO, getCanonicalOrLatestVersion } from './get.server.js';

async function dbUpdateWork(user: UserDBO, workId: string, key: string) {
  const prisma = await getPrismaClient();
  const work = await prisma.work.update({
    where: {
      id: workId,
    },
    data: {
      date_modified: new Date().toISOString(),
      key,
    },
    include: {
      versions: true,
    },
  });
  return work;
}

export default async function (ctx: Context, workId: string, key: string) {
  if (!ctx.user) throw error401();
  const currentWork = await dbGetWorkForUser(ctx.user, workId);
  if (!currentWork) throw error404();
  if (currentWork.key) throw httpError(400, 'work already has key');
  const work = await dbUpdateWork(ctx.user, workId, key);
  if (!work) throw error404();
  return formatWorkDTO(ctx, work, getCanonicalOrLatestVersion(work.versions));
}
