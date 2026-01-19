import type { getPrismaClient } from '@curvenote/scms-server';

export type SlugsDTO = Awaited<
  ReturnType<Awaited<ReturnType<typeof getPrismaClient>>['slug']['findMany']>
>;
