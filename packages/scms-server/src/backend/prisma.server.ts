// lib/prisma.server.ts
// Re-export from @curvenote/scms-db for backward compatibility
// This allows existing code to continue using getPrismaClient from this location
import { getLowLevelPrismaClient, getNamedLowLevelPrismaClient } from '@curvenote/scms-db';
import { getConfig } from '../app-config.server.js';
import type { PrismaClient } from '@curvenote/scms-db';

/** Cache key for the dedicated public works-listing pool (see {@link getWorksListingPrismaClient}). */
const WORKS_LISTING_CLIENT_NAME = 'works-listing';

/**
 * Gets the PrismaClient instance, using the database URL from app config.
 *
 * This is a wrapper around @curvenote/scms-db's getPrismaClient that integrates
 * with the app config system. The database URL from config.api.databaseUrl
 * is passed to the db package.
 *
 * IMPORTANT: for 6543 (transaction pooling)
 * ensure your config.api.databaseUrl already includes:
 *   ?pgbouncer=true&connection_limit=1&pool_timeout=30
 */
export async function getPrismaClient(): Promise<PrismaClient> {
  const config = await getConfig();
  return getLowLevelPrismaClient(config.api.databaseUrl, config.api.databaseCACertificate);
}

/**
 * Gets a PrismaClient backed by a DEDICATED connection pool for the public works
 * listing/search endpoint (`/api/v1/sites/:siteName/works`).
 *
 * Same database, same per-pool tuning as {@link getPrismaClient} (it resolves
 * the same config), but a separate `pg.Pool` so this endpoint's heavy
 * listing/search/count queries draw from their own connection budget and cannot
 * exhaust the shared `default` pool that serves the rest of the app (and vice
 * versa). See `getNamedLowLevelPrismaClient` for the connection-budget caveat.
 */
export async function getWorksListingPrismaClient(): Promise<PrismaClient> {
  const config = await getConfig();
  return getNamedLowLevelPrismaClient(
    WORKS_LISTING_CLIENT_NAME,
    config.api.databaseUrl,
    config.api.databaseCACertificate,
  );
}
