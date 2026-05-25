import { getPrismaClient, hasSiteScope, type Context } from '@curvenote/scms-server';
import type { SiteRole } from '@curvenote/scms-db';
import { scopes } from '@curvenote/scms-core';

export type SiteSelectOption = {
  id: string;
  name: string;
};

/** Minimal site names for admin submission tools (not my.sites / formatSiteDTO). */
export async function dbListSitesForSelect(ctx: Context): Promise<SiteSelectOption[]> {
  if (!ctx.user) {
    return [];
  }

  const prisma = await getPrismaClient();

  if ((ctx.user.system_scopes ?? []).includes(scopes.system.admin)) {
    return prisma.site.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  const siteUsers = await prisma.siteUser.findMany({
    where: {
      user_id: ctx.user.id,
      site: { external: false },
    },
    distinct: ['site_id'],
    select: {
      role: true,
      site: { select: { id: true, name: true } },
    },
  });

  return siteUsers
    .filter(({ role }) => hasSiteScope(role as SiteRole, scopes.site.list))
    .sort((a, b) => a.site.name.localeCompare(b.site.name, undefined, { sensitivity: 'base' }))
    .map(({ site }) => site);
}
