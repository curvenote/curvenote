/**
 * Server helpers for site backend (Curvenote CDN vs AT Protocol) configuration.
 */

import { getPrismaClient, safeSiteDataUpdate } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';
import type { SiteBackendConfig } from '../backend/db.server.js';
import { SITE_DATA_SCHEMA } from '../backend/db.server.js';

export type SiteUserWithBluesky = {
  userId: string;
  displayName: string | null;
  linkedAccountId: string;
  handleOrDid: string;
};

/**
 * Get site users (with any site role) who have a Bluesky linked account with an active session.
 * Used to populate the "nominated user" dropdown when backend type is AT Protocol.
 */
export async function getSiteUsersWithBlueskySession(
  siteId: string,
): Promise<SiteUserWithBluesky[]> {
  const prisma = await getPrismaClient();
  const siteUsers = await prisma.siteUser.findMany({
    where: { site_id: siteId },
    include: {
      user: {
        include: {
          linkedAccounts: {
            where: { provider: 'bluesky' },
            include: {
              sessions: {
                where: { active: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  const result: SiteUserWithBluesky[] = [];
  for (const su of siteUsers) {
    const blueskyAccount = su.user.linkedAccounts.find((a) => a.provider === 'bluesky');
    if (!blueskyAccount || blueskyAccount.sessions.length === 0) continue;
    const profile = blueskyAccount.profile as { handle?: string; did?: string } | null;
    const handleOrDid = profile?.handle ?? profile?.did ?? blueskyAccount.idAtProvider ?? blueskyAccount.id;
    result.push({
      userId: su.user.id,
      displayName: su.user.display_name ?? su.user.username ?? null,
      linkedAccountId: blueskyAccount.id,
      handleOrDid,
    });
  }
  return result;
}

/**
 * Update site.data.backend and site.data.$schema using OCC.
 * Preserves other keys in site.data.
 */
export async function updateSiteBackend(
  siteId: string,
  backend: SiteBackendConfig,
  schemaUrl: string = SITE_DATA_SCHEMA,
): Promise<void> {
  await safeSiteDataUpdate<Prisma.JsonObject>(siteId, (currentData) => {
    const data = (currentData as Record<string, unknown>) ?? {};
    return {
      ...data,
      $schema: schemaUrl,
      backend,
    } as Prisma.JsonObject;
  });
}
