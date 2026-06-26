/**
 * Server-side entry point for @curvenote/scms-db
 *
 * This exports the PrismaClient factory function with the PostgreSQL adapter.
 * Use this in server-side code (React Router loaders, actions, API routes).
 *
 * @example
 * ```ts
 * import { getPrismaClient } from '@curvenote/scms-db';
 * const prisma = await getPrismaClient();
 * const users = await prisma.user.findMany();
 * ```
 */

import type { Prisma } from './generated/client.js';
import { PrismaClient } from './generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Type-safe global cache (dev hot-reload & serverless runtime reuse). Keyed by
// pool name so the process can hold more than one isolated client/pool (e.g. a
// dedicated pool for a hot endpoint, see `getNamedLowLevelPrismaClient`).
const g = globalThis as unknown as {
  __prismaClients?: Map<string, PrismaClient>;
  __prismaInits?: Map<string, Promise<PrismaClient>>;
};

/** Cache key for the shared, app-wide default client/pool. */
const DEFAULT_CLIENT_NAME = 'default';

function isPrismaQueryDebugEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const flag = process.env.PRISMA_DEBUG_QUERIES?.toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

type PrismaQueryEvent = {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
};

function attachQueryDebugLogging(client: PrismaClient): void {
  (
    client as unknown as { $on(event: 'query', callback: (event: PrismaQueryEvent) => void): void }
  ).$on('query', (event) => {
    console.log('\n' + '─'.repeat(80));
    console.log(`[prisma:query] ${event.duration}ms`);
    console.log(event.query);
    if (event.params !== '[]') {
      console.log('Params:', event.params);
    }
    console.log('─'.repeat(80) + '\n');
  });
}

/**
 * Creates a PrismaClient instance with the PostgreSQL adapter.
 *
 * @param connectionString - Database connection string. If not provided, uses DATABASE_URL env var.
 * @returns Configured PrismaClient instance
 */
function makeClient(connectionString?: string, dbCACertificate?: string): PrismaClient {
  const dbUrl = connectionString || process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required, or provide a connection string to getPrismaClient()',
    );
  }

  // Small per-process pool for Vercel warm-instance concurrency; Supabase still handles backend pooling.
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbCACertificate ? { ca: dbCACertificate } : undefined,
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 30_000,
  });
  pool.on('error', (error) => {
    console.error('[db:pool:error]', error);
  });

  const adapter = new PrismaPg(pool);
  const debugQueries = isPrismaQueryDebugEnabled();

  const opts: Prisma.PrismaClientOptions = {
    adapter,
    log: debugQueries
      ? [
          { level: 'query', emit: 'event' },
          { level: 'warn', emit: 'stdout' },
          { level: 'error', emit: 'stdout' },
        ]
      : process.env.NODE_ENV !== 'production'
        ? ['warn', 'error']
        : ['error'],
    errorFormat: process.env.NODE_ENV !== 'production' ? 'pretty' : 'colorless',
    transactionOptions: {
      maxWait: 5000, // wait for a pooled backend slot
      // Interactive txs (writes) can span several queries; 10s was too tight for slow dev DBs / large reads mistaken for txs.
      timeout: 30000,
    },
  };

  const client = new PrismaClient(opts);

  if (debugQueries) {
    attachQueryDebugLogging(client);
  }

  return client;
}

/**
 * Gets or creates the singleton PrismaClient instance.
 * 
 * NOTE: do not use this directly, use getPrismaClient from scms-server instead for a
 * properly configured Prisma client instance.
 *
 * This function implements a singleton pattern to ensure only one PrismaClient
 * instance exists per process, which is important for connection pooling and
 * serverless environments.
 *
 * @param connectionString - Optional database connection string. If not provided,
 *                           uses DATABASE_URL env var. Only used on first call.
 * @returns Promise that resolves to the PrismaClient instance

 * 
 */
export async function getLowLevelPrismaClient(
  connectionString?: string,
  dbCACertificate?: string,
): Promise<PrismaClient> {
  return getNamedLowLevelPrismaClient(DEFAULT_CLIENT_NAME, connectionString, dbCACertificate);
}

/**
 * Gets or creates a NAMED singleton PrismaClient instance, each backed by its
 * own `pg.Pool`.
 *
 * Distinct names yield distinct clients/pools that do not share connections, so
 * a heavy endpoint can be given a dedicated pool that cannot starve the shared
 * `default` pool (and vice versa). Same name returns the same cached instance.
 *
 * All names built from the same `connectionString` talk to the same database
 * with the same per-pool tuning (see `makeClient`); isolation is at the pool
 * (connection-budget) level only. NOTE: each named pool adds up to its own `max`
 * connections to the backend, so the total connection budget is the sum across
 * names — size accordingly against the database / pooler limits.
 *
 * @param name - Cache key identifying the pool (e.g. `'default'`, `'works-listing'`).
 * @param connectionString - Optional database connection string. Only used on
 *                           the first call for a given `name`.
 * @param dbCACertificate - Optional CA certificate. Only used on the first call
 *                          for a given `name`.
 */
export async function getNamedLowLevelPrismaClient(
  name: string,
  connectionString?: string,
  dbCACertificate?: string,
): Promise<PrismaClient> {
  const clients = (g.__prismaClients ??= new Map());
  const inits = (g.__prismaInits ??= new Map());

  const existing = clients.get(name);
  if (existing) return existing;
  const pending = inits.get(name);
  if (pending) return pending;

  const init = (async () => {
    try {
      const client = makeClient(connectionString, dbCACertificate);

      if (process.env.NODE_ENV !== 'production') {
        // fail fast in dev and prove the pool path is correct
        await client.$connect();
      }

      clients.set(name, client);
      return client;
    } catch (error) {
      // Clear the cached promise on failure to allow retries
      inits.delete(name);
      throw error;
    }
  })();

  inits.set(name, init);
  return init;
}

// Re-export types and the Prisma namespace from the generated client for server-side usage
export { Prisma, PrismaClient } from './generated/client.js';
export * from './generated/client.js';
