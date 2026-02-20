import { getPrismaClient } from '@curvenote/scms-server';

/**
 * Backend configuration stored in site.data.backend
 */
export type SiteBackendConfig =
  | { type: 'curvenote-cdn' }
  // Single nominated Bluesky linked account used for writes to that user's PDS.
  | { type: 'atproto'; nominatedUserLinkedAccountId: string };

/**
 * Schema reference for site.data JSON (top-level $schema key)
 */
export const SITE_DATA_SCHEMA = 'https://curvenote.com/schemas/site-data/v1';

/**
 * Site data structure for internal app use
 * This includes fields not exposed via the public API
 */
export type SiteAppData = {
  magicLinksEnabled?: boolean;
  /** @see SITE_DATA_SCHEMA */
  $schema?: string;
  backend?: SiteBackendConfig;
};

/**
 * Extended site information for use within the app
 * Includes internal data not exposed via public API
 */
export type SiteWithAppData = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  private: boolean;
  restricted: boolean;
  data: SiteAppData | null;
};

/**
 * Get site with app-specific data for internal use
 * This should NOT be used for public API responses
 */
export async function getSiteWithAppData(siteName: string): Promise<SiteWithAppData | null> {
  const prisma = await getPrismaClient();
  const site = await prisma.site.findUnique({
    where: { name: siteName },
    select: {
      id: true,
      name: true,
      title: true,
      description: true,
      private: true,
      restricted: true,
      data: true,
    },
  });

  if (!site) return null;

  return {
    ...site,
    data: (site.data as SiteAppData) ?? null,
  };
}
