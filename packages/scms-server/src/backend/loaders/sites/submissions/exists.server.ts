import { getPrismaClient } from '../../../prisma.server.js';
import type { SiteContext } from '../../../context.site.server.js';

export async function dbSubmissionExistsOnSite(siteName: string, submissionId: string) {
  const prisma = await getPrismaClient();
  const submission = await prisma.submission.findFirst({
    where: {
      id: submissionId,
      site: { name: siteName },
    },
    select: { id: true },
  });
  return submission != null;
}

export default async function (ctx: SiteContext, submissionId: string) {
  return dbSubmissionExistsOnSite(ctx.site.name, submissionId);
}
