import { uuidv7 as uuid } from 'uuidv7';
import type { Prisma, SiteRole } from '@prisma/client';
import { formatDate } from '@curvenote/common';
import { getPrismaClient } from '@curvenote/scms-server';

export async function dbAddSiteUserRole(siteId: string, userId: string, role: SiteRole) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();
  return prisma.siteUser.create({
    data: {
      id: uuid(),
      // use same timestamp for created and modified
      date_created: timestamp,
      date_modified: timestamp,
      site_id: siteId,
      user_id: userId,
      role,
    },
  });
}

export async function dbRemoveSiteUserRole(siteId: string, userId: string, role: SiteRole) {
  const prisma = await getPrismaClient();
  return prisma.siteUser.deleteMany({
    where: {
      site_id: siteId,
      user_id: userId,
      role,
    },
  });
}

export async function dbGetUserByEmail(email: string) {
  const prisma = await getPrismaClient();
  return prisma.user.findFirst({
    where: { email },
    include: {
      site_roles: {
        include: {
          site: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });
}

export async function dbGetUserById(userId: string) {
  const prisma = await getPrismaClient();
  return prisma.user.findFirst({
    where: { id: userId },
    include: {
      site_roles: {
        include: {
          site: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });
}

export async function dbGetSiteUsers(siteName: string) {
  const prisma = await getPrismaClient();
  return prisma.user.findMany({
    where: {
      site_roles: {
        some: {
          site: {
            name: siteName,
          },
        },
      },
    },
    include: {
      site_roles: {
        where: {
          site: {
            name: siteName,
          },
        },
      },
    },
  });
}

export type DBO = Exclude<Prisma.PromiseReturnType<typeof dbGetSiteUsers>, null | undefined>;

export function dtoSiteUsers(dbo: DBO) {
  return dbo.map((user) => ({
    id: user.id,
    display_name: user.display_name,
    date_created: user.date_created,
    email: user.email,
    role: user.system_role,
    site_roles: user.site_roles.map((sr) => sr.role),
  }));
}
