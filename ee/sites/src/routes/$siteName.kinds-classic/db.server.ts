import { getPrismaClient } from '@curvenote/scms-server';
import type { Prisma } from '@curvenote/scms-db';
import { uuidv7 } from 'uuidv7';

export async function dbListSubmissionKinds(siteId: string) {
  const prisma = await getPrismaClient();
  return prisma.submissionKind.findMany({
    where: {
      site: {
        id: siteId,
      },
    },
    orderBy: {
      name: 'asc',
    },
  });
}

export type DBO = Awaited<ReturnType<typeof dbListSubmissionKinds>>;

export async function dbSubmissionKindExists(
  siteName: string,
  where: Prisma.SubmissionKindWhereInput,
) {
  const prisma = await getPrismaClient();
  const count = await prisma.submissionKind.count({
    where: {
      site: {
        name: siteName,
      },
      ...where,
    },
  });
  return count > 0;
}

export async function dbCreateKind(
  siteName: string,
  data: {
    name: string;
    title: string;
    description?: string;
    default: boolean;
    checks: { id: string }[];
  },
) {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const timestamp = new Date().toISOString();

    if (data.default) {
      await tx.submissionKind.updateMany({
        where: {
          site: {
            name: siteName,
          },
        },
        data: {
          default: false,
        },
      });
    }

    return tx.submissionKind.create({
      data: {
        id: uuidv7(),
        site: {
          connect: {
            name: siteName,
          },
        },
        name: data.name,
        content: {
          title: data.title,
          description: data.description,
        },
        default: data.default,
        checks: data.checks,
        date_created: timestamp,
        date_modified: timestamp,
      },
    });
  });
}
