// lib/prisma.server.ts
// Re-export from @curvenote/scms-db for backward compatibility
// This allows existing code to continue using getPrismaClient from this location
import { getLowLevelPrismaClient } from '@curvenote/scms-db';
import { getConfig } from '../app-config.server.js';
import type { PrismaClient } from '@curvenote/scms-db';

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
  return getLowLevelPrismaClient(config.api.databaseUrl);
}
