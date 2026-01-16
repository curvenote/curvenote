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

import { PrismaClient, Prisma } from './generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Type-safe global cache (dev hot-reload & serverless runtime reuse)
const g = globalThis as unknown as {
  __prisma?: PrismaClient;
  __prismaInit?: Promise<PrismaClient>;
};

/**
 * Creates a PrismaClient instance with the PostgreSQL adapter.
 *
 * @param connectionString - Database connection string. If not provided, uses DATABASE_URL env var.
 * @returns Configured PrismaClient instance
 */
function makeClient(connectionString?: string): PrismaClient {
  const dbUrl = connectionString || process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required, or provide a connection string to getPrismaClient()',
    );
  }

  // Create a connection pool for the adapter
  const pool = new Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);

  const opts: Prisma.PrismaClientOptions = {
    adapter,
    log: process.env.NODE_ENV !== 'production' ? ['warn', 'error'] : ['error'],
    errorFormat: process.env.NODE_ENV !== 'production' ? 'pretty' : 'colorless',
    transactionOptions: {
      maxWait: 5000, // wait for a pooled backend slot
      timeout: 10000, // long transaction guard
    },
  };

  return new PrismaClient(opts);
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
export async function getLowLevelPrismaClient(connectionString?: string): Promise<PrismaClient> {
  if (g.__prisma) return g.__prisma;
  if (g.__prismaInit) return g.__prismaInit;

  g.__prismaInit = (async () => {
    try {
      const client = makeClient(connectionString);

      if (process.env.NODE_ENV !== 'production') {
        // fail fast in dev and prove the pool path is correct
        await client.$connect();
      }

      g.__prisma = client;
      return client;
    } catch (error) {
      // Clear the cached promise on failure to allow retries
      g.__prismaInit = undefined;
      throw error;
    }
  })();

  return g.__prismaInit;
}

// Re-export types and the Prisma namespace from the generated client for server-side usage
export { Prisma, PrismaClient } from './generated/client.js';
export * from './generated/client.js';
