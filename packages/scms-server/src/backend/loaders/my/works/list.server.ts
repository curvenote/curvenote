import type { Prisma } from '@prisma/client';
import type { WorksDTO } from '@curvenote/common';
import type { Context } from '../../../context.server.js';
import { getPrismaClient } from '../../../prisma.server.js';
import type { UserDBO } from '../../../db.types.js';
import { error401, error404 } from '@curvenote/scms-core';
import { formatWorkDTO, getCanonicalOrLatestVersion } from '../../works/get.server.js';

async function dbListWorksForUser(user: UserDBO, where: Prisma.WorkWhereInput = {}) {
  const prisma = await getPrismaClient();
  const works = await prisma.work.findMany({
    where: {
      work_users: {
        some: {
          user_id: user.id,
        },
      },
      ...where,
    },
    include: {
      versions: {
        orderBy: {
          date_created: 'desc',
        },
      },
    },
    orderBy: {
      date_created: 'desc',
    },
  });
  return works;
}

type DBO = Exclude<Prisma.PromiseReturnType<typeof dbListWorksForUser>, null>;

export function formatMyWorksDTO(ctx: Context, dbo: DBO, where?: Prisma.WorkWhereInput): WorksDTO {
  const selfQuery = where?.key ? `?key=${where.key}` : '';
  return {
    items: dbo.map((work) => formatWorkDTO(ctx, work, getCanonicalOrLatestVersion(work.versions))),
    links: {
      self: ctx.asApiUrl(`/my/works${selfQuery}`),
    },
  };
}

export default async function (ctx: Context, where?: Prisma.WorkWhereInput) {
  if (!ctx.user) throw error401();
  const dbo = await dbListWorksForUser(ctx.user, where);
  if (!dbo) throw error404();
  return formatMyWorksDTO(ctx, dbo, where);
}
