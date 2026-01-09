import { getPrismaClient } from '../../../prisma.server.js';

export async function dbGetWorkVersion(workId: string, workVersionId: string) {
  const prisma = await getPrismaClient();
  const workVersion = await prisma.workVersion.findUnique({
    where: {
      id: workVersionId,
      work_id: workId,
    },
  });
  return workVersion;
}
