import type { UserSitesDTO } from '@curvenote/common';
import type { Prisma, User as UserDBO } from '@prisma/client';
import { getPrismaClient } from '../../prisma.server.js';
import type { Context } from '../../context.server.js';
import { hasSiteScope, hasScopeViaSystemRole } from '../../roles.server.js';
import { error401, scopes } from '@curvenote/scms-core';
import { formatSiteDTO } from '../sites/get.server.js';

/**
 * List the sites for the user.
 *
 * For users with the system scope of scopes.system.admin, this will be all the sites.
 * For users without the system role of scopes.system.site.list, this will be all the sites they have scopes.site.list scope on.
 *
 * @param user
 * @returns
 * @see listWorksForUser
 */
async function dbListSitesForUser(user: UserDBO) {
  if (hasScopeViaSystemRole(user.system_role, scopes.system.admin)) {
    // lookup across all sites
    const prisma = await getPrismaClient();
    const sites = await prisma.site.findMany({
      // where: {
      //   external: false,
      // },
      include: {
        site_users: true,
        submissionKinds: true,
        collections: { orderBy: { date_created: 'desc' } },
        domains: true,
      },
      orderBy: { name: 'asc' },
    });

    return sites.map((site) => {
      const { site_users, ...rest } = site;
      const user_roles = site_users.filter((su) => su.user_id === user.id).map((su) => su.role);
      return {
        ...rest,
        role: user_roles[0] ?? null,
      };
    });
  } else {
    // lookup only for sites the user has a role for
    const prisma = await getPrismaClient();
    const site_users = await prisma.siteUser.findMany({
      where: {
        user: {
          id: user.id,
        },
        site: {
          external: false,
        },
      },
      include: {
        site: {
          include: {
            submissionKinds: true,
            collections: { orderBy: { date_created: 'desc' } },
            domains: true,
          },
        },
      },
      distinct: ['site_id'],
    });

    const sitesWithRole = site_users.map((su) => {
      const { site, role } = su;
      return {
        ...site,
        role,
      };
    });

    // Sort by name (case-insensitive)
    sitesWithRole.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    return sitesWithRole.filter(({ role }) => hasSiteScope(role, scopes.site.list));
  }
}

export type UserSiteDBO = Prisma.PromiseReturnType<typeof dbListSitesForUser>[0];

function formatMySitesDTO(ctx: Context, sites: UserSiteDBO[]): UserSitesDTO {
  return {
    items: sites.map((site) => ({ ...formatSiteDTO(ctx, site), role: site.role })),
    links: {
      self: ctx.asApiUrl('/my/sites'),
      user: ctx.asApiUrl('/my/user'),
    },
  };
}

export default async function (ctx: Context) {
  if (!ctx.user) throw error401();
  const dbo = await dbListSitesForUser(ctx.user);
  return formatMySitesDTO(ctx, dbo);
}
