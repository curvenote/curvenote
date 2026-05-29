import { PrismaClient, type Prisma } from '@curvenote/scms-db';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export type PrismaDb = PrismaClient;

export function createPrismaClient(
  connectionString: string,
  options?: { sslRejectUnauthorized?: boolean; poolMax?: number },
): PrismaDb {
  const useSsl =
    options?.sslRejectUnauthorized === false ||
    /sslmode=require/i.test(connectionString) ||
    /\.supabase\.co/i.test(connectionString);

  const pool = new Pool({
    connectionString,
    max: options?.poolMax ?? 4,
    ssl: useSsl ? { rejectUnauthorized: options?.sslRejectUnauthorized !== false } : undefined,
  });

  const adapter = new PrismaPg(pool);
  const log: Prisma.LogLevel[] =
    process.env.PRISMA_DEBUG_QUERIES === '1' ? ['query', 'warn', 'error'] : ['warn', 'error'];

  return new PrismaClient({
    adapter,
    log,
    transactionOptions: { maxWait: 10_000, timeout: 120_000 },
  });
}

export async function disconnectPrisma(client: PrismaDb, poolLabel: string): Promise<void> {
  await client.$disconnect();
  // Prisma 7 + adapter-pg: pool is owned by adapter; disconnect is sufficient for scripts.
  void poolLabel;
}
