import type { UserDBO } from '../../db.types.js';
import { getPrismaClient } from '../../prisma.server.js';
import type { Context } from '../../context.server.js';
import { error401 } from '@curvenote/scms-core';

async function dbCountSitesForUser(user: UserDBO) {
  const prisma = await getPrismaClient();
  return prisma.siteUser.findMany({
    where: { user_id: user.id },
    distinct: ['site_id'],
    select: { id: true },
  });
}

export default async function (ctx: Context) {
  if (!ctx.user) throw error401();
  const dbo = await dbCountSitesForUser(ctx.user);
  return dbo.length ?? 0;
}
