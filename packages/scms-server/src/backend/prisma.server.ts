// lib/prisma.server.ts
import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { getConfig } from '../app-config.server.js';

// Type-safe global cache (dev hot-reload & serverless runtime reuse)
const g = globalThis as unknown as {
  __prisma?: PrismaClient;
  __prismaInit?: Promise<PrismaClient>;
};

function makeClient(dbUrl: string) {
  const opts: Prisma.PrismaClientOptions = {
    datasources: { db: { url: dbUrl } },
    log: process.env.NODE_ENV !== 'production' ? ['warn', 'error'] : ['error'],
    errorFormat: process.env.NODE_ENV !== 'production' ? 'pretty' : 'colorless',
    transactionOptions: {
      maxWait: 5000, // wait for a pooled backend slot
      timeout: 10000, // long transaction guard
    },
  };
  return new PrismaClient(opts);
}

export async function getPrismaClient(): Promise<PrismaClient> {
  if (g.__prisma) return g.__prisma;
  if (g.__prismaInit) return g.__prismaInit;

  g.__prismaInit = (async () => {
    try {
      const config = await getConfig();
      // IMPORTANT: for 6543 (transaction pooling)
      // ensure your config.api.databaseUrl already includes:
      //   ?pgbouncer=true&connection_limit=1&pool_timeout=30
      const client = makeClient(config.api.databaseUrl);

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
