import { uuidv7 as uuid } from 'uuidv7';
import { SystemRole } from '@curvenote/scms-db';
import type { SiteRole } from '@curvenote/scms-db';
import { getPrismaClient } from '@curvenote/scms-server';

export function formatDefaultServiceAccountDisplayName(siteTitle: string) {
  return `${siteTitle} Service Account`;
}

export async function dbGetSiteServiceAccount(siteId: string) {
  const prisma = await getPrismaClient();
  // If more than one exists for any reason, pick the oldest.
  return prisma.user.findFirst({
    where: {
      system_role: SystemRole.SERVICE,
      site_roles: {
        some: {
          site_id: siteId,
        },
      },
    },
    include: {
      // Only pull the role record(s) that apply to *this* site.
      site_roles: {
        where: { site_id: siteId },
      },
    },
    orderBy: { date_created: 'asc' },
  });
}

export async function dbCreateSiteServiceAccount(
  site: {
    id: string;
    name: string;
    title: string;
  },
  role: SiteRole,
) {
  const prisma = await getPrismaClient();
  const timestamp = new Date().toISOString();
  const userId = uuid();
  const displayName = formatDefaultServiceAccountDisplayName(site.title);

  // Prevent duplicates (best-effort; no unique constraint at DB level).
  const existing = await dbGetSiteServiceAccount(site.id);
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: userId,
        date_created: timestamp,
        date_modified: timestamp,
        system_role: SystemRole.SERVICE,
        display_name: displayName,
        // Intentionally no email/username for now; these are machine users.
      },
    });

    await tx.siteUser.create({
      data: {
        id: uuid(),
        date_created: timestamp,
        date_modified: timestamp,
        site_id: site.id,
        user_id: userId,
        role,
      },
      select: { id: true },
    });

    return user;
  });
}

/**
 * Revoke a site-scoped service account.
 *
 * Deletes all tokens belonging to the service account user and removes the
 * SiteUser linkage so the account loses access to this site. The underlying
 * User row is preserved to keep any audit trail intact and to leave room for
 * a future "soft restore"; subsequent calls to {@link dbGetSiteServiceAccount}
 * will report no service account because that lookup requires a site_role
 * association on the requested site.
 */
export async function dbDeleteSiteServiceAccount(siteId: string, userId: string) {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    await tx.userToken.deleteMany({ where: { user_id: userId } });
    await tx.siteUser.deleteMany({ where: { user_id: userId, site_id: siteId } });
  });
}

export async function dbListTokensForUser(userId: string) {
  const prisma = await getPrismaClient();
  return prisma.userToken.findMany({
    where: { user_id: userId },
    orderBy: { date_created: 'desc' },
  });
}

export async function dbCreateTokenForUser(
  userId: string,
  description: string,
  date_expires?: string,
) {
  const prisma = await getPrismaClient();
  const timestamp = new Date().toISOString();
  return prisma.userToken.create({
    data: {
      user_id: userId,
      id: uuid(),
      description,
      date_created: timestamp,
      date_modified: timestamp,
      date_expires,
    },
  });
}

export async function dbDeleteTokenForUser(userId: string, tokenId: string) {
  const prisma = await getPrismaClient();
  return prisma.userToken.deleteMany({
    where: {
      id: tokenId,
      user_id: userId,
    },
  });
}
