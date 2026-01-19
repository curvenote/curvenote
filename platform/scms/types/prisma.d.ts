import type { PrismaClient } from '@curvenote/scms-db';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}
