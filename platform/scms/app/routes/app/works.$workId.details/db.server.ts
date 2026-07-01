import { getPrismaClient } from '@curvenote/scms-server';

export async function dbUpdateWorkDoi(workId: string, doi: string | null) {
  const prisma = await getPrismaClient();
  return prisma.work.update({
    where: { id: workId },
    data: {
      doi,
      date_modified: new Date().toISOString(),
    },
    select: { id: true, doi: true },
  });
}
