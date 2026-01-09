import type { Prisma } from '@prisma/client';
import type { getPrismaClient } from '@curvenote/scms-server';

export type SlugsDTO = Prisma.PromiseReturnType<
  Prisma.PromiseReturnType<typeof getPrismaClient>['slug']['findMany']
>;
