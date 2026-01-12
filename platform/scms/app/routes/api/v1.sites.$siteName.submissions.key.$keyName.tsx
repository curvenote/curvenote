import type { Route } from './+types/v1.sites.$siteName.submissions.key.$keyName';
import { withAPISiteContext, getPrismaClient } from '@curvenote/scms-server';
import { site } from '@curvenote/scms-core';

export async function loader(args: Route.LoaderArgs) {
  const ctx = await withAPISiteContext(args, [site.submissions.create]);
  const { keyName } = args.params;
  const prisma = await getPrismaClient();
  const count = await prisma.submission.count({
    where: {
      site: { name: ctx.site.name },
      versions: {
        some: {
          work_version: { is: { work: { is: { key: keyName } } } },
        },
      },
    },
  });
  if (count === 0) return { exists: false };
  return { exists: true };
}
