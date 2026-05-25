import {
  getPrismaClient,
  hasSiteScope,
  type Context,
  type MyUserDBO,
} from '@curvenote/scms-server';
import type { SiteRole } from '@curvenote/scms-db';
import { error401, scopes } from '@curvenote/scms-core';
import { formatSiteCardItem, type SiteCardRow } from './listing.format.server.js';
import type { SiteCardListing } from './types.js';

const siteCardSelect = {
  id: true,
  name: true,
  title: true,
  external: true,
  metadata: true,
} as const;

async function dbListAllSiteCardRows(): Promise<SiteCardRow[]> {
  const prisma = await getPrismaClient();
  return prisma.site.findMany({
    select: siteCardSelect,
    orderBy: { name: 'asc' },
  });
}

async function dbListSiteCardRowsForUser(
  userId: string,
): Promise<{ role: string; site: SiteCardRow }[]> {
  const prisma = await getPrismaClient();
  const siteUsers = await prisma.siteUser.findMany({
    where: {
      user_id: userId,
      site: { external: false },
    },
    distinct: ['site_id'],
    select: {
      role: true,
      site: { select: siteCardSelect },
    },
  });
  return siteUsers;
}

async function dbListSiteCardRows(user: MyUserDBO): Promise<SiteCardRow[]> {
  if ((user.system_scopes ?? []).includes(scopes.system.admin)) {
    return dbListAllSiteCardRows();
  }

  const siteUsers = await dbListSiteCardRowsForUser(user.id);
  const withListScope = siteUsers.filter(({ role }) =>
    hasSiteScope(role as SiteRole, scopes.site.list),
  );

  withListScope.sort((a, b) =>
    a.site.name.localeCompare(b.site.name, undefined, { sensitivity: 'base' }),
  );

  return withListScope.map(({ site }) => site);
}

/**
 * My Sites grid — local to this route; does not use my.sites / formatSiteDTO.
 */
export async function dbListSiteCards(ctx: Context): Promise<SiteCardListing> {
  if (!ctx.user) {
    throw error401();
  }

  const rows = await dbListSiteCardRows(ctx.user);
  return {
    items: rows.map(formatSiteCardItem),
  };
}
