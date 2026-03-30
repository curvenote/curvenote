import type { Prisma } from '@curvenote/scms-db';
import type { WorksDTO } from '@curvenote/common';
import type { Context } from '../../../context.server.js';
import { getPrismaClient } from '../../../prisma.server.js';
import type { UserDBO, WorkVersionDBO } from '../../../db.types.js';
import { error401, error404 } from '@curvenote/scms-core';
import { formatWorkDTO, getCanonicalOrLatestVersion } from '../../works/get.server.js';

export type MyWorksListFilters = {
  key?: string;
  cdnKey?: string;
};

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

type DBO = Exclude<Awaited<ReturnType<typeof dbListWorksForUser>>, null>;

function versionMatchingCdnKey(
  versions: WorkVersionDBO[] | undefined,
  cdnKey: string,
): WorkVersionDBO | undefined {
  return versions?.find((v) => v.cdn_key === cdnKey);
}

function selfQueryFromFilters(filters?: MyWorksListFilters): string {
  if (filters?.cdnKey) return `?cdn-key=${encodeURIComponent(filters.cdnKey)}`;
  if (filters?.key) return `?key=${encodeURIComponent(filters.key)}`;
  return '';
}

export function formatMyWorksDTO(ctx: Context, dbo: DBO, filters?: MyWorksListFilters): WorksDTO {
  const selfQuery = selfQueryFromFilters(filters);
  return {
    items: dbo.map((work) => {
      const version = filters?.cdnKey
        ? versionMatchingCdnKey(work.versions, filters.cdnKey) ??
          getCanonicalOrLatestVersion(work.versions ?? [])
        : getCanonicalOrLatestVersion(work.versions ?? []);
      return formatWorkDTO(ctx, work, version);
    }),
    links: {
      self: ctx.asApiUrl(`/my/works${selfQuery}`),
    },
  };
}

function buildWhere(filters?: MyWorksListFilters): Prisma.WorkWhereInput {
  if (filters?.cdnKey) {
    return {
      versions: {
        some: {
          cdn_key: filters.cdnKey,
        },
      },
    };
  }
  if (filters?.key) {
    return { key: filters.key };
  }
  return {};
}

export default async function (ctx: Context, filters?: MyWorksListFilters) {
  if (!ctx.user) throw error401();
  const where = buildWhere(filters);
  const dbo = await dbListWorksForUser(ctx.user, where);
  if (!dbo) throw error404();
  return formatMyWorksDTO(ctx, dbo, filters);
}
