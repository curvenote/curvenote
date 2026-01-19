import { $Enums } from '@curvenote/scms-db';
import { uuidv7 } from 'uuidv7';
import { getPrismaClient } from '@curvenote/scms-server';

export async function dbListCollections() {
  const prisma = await getPrismaClient();
  return prisma.collection.findMany({
    include: {
      kindsInCollection: {
        include: {
          kind: {
            include: {
              site: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      site: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function dbListSubmissions() {
  const prisma = await getPrismaClient();
  return prisma.submission.findMany({
    orderBy: {
      site: { name: 'asc' },
    },
    include: {
      site: {
        select: {
          id: true,
          name: true,
        },
      },
      collection: {
        include: {
          kindsInCollection: {
            include: {
              kind: true,
            },
          },
          site: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      kind: {
        include: {
          site: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
}

export async function dbListWorksWithoutUsers(take: number) {
  const prisma = await getPrismaClient();
  return prisma.work.findMany({
    where: {
      work_users: {
        none: {},
      },
    },
    take,
    include: {
      created_by: true,
    },
  });
}

export async function dbCreateWorkUsers(
  work: Awaited<ReturnType<typeof dbListWorksWithoutUsers>>[0],
) {
  const prisma = await getPrismaClient();
  return prisma.workUser.create({
    data: {
      id: uuidv7(),
      date_created: work.date_created,
      date_modified: work.date_created,
      work_id: work.id,
      user_id: work.created_by_id,
      role: $Enums.WorkRole.OWNER,
    },
  });
}

export async function dbListSubmissionsWithoutWorks(take: number) {
  const prisma = await getPrismaClient();
  return prisma.submission.findMany({
    where: {
      work: null,
    },
    take,
    include: {
      submitted_by: {
        select: {
          id: true,
          display_name: true,
        },
      },
      site: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function dbAddWorkToSubmission(id: string) {
  const prisma = await getPrismaClient();
  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      versions: {
        include: {
          work_version: true,
        },
        orderBy: {
          date_created: 'desc',
        },
        take: 1,
      },
    },
  });
  const workId = submission?.versions[0]?.work_version?.work_id;
  if (!workId) return;
  return prisma.submission.update({
    where: {
      id,
    },
    data: {
      date_modified: new Date().toISOString(),
      work: {
        connect: {
          id: workId,
        },
      },
    },
  });
}

export async function dbListAllDomains() {
  const prisma = await getPrismaClient();
  return prisma.domain.findMany({
    include: {
      site: {
        select: {
          id: true,
          name: true,
          title: true,
        },
      },
    },
  });
}

export async function dbSetDefaultDomain(domainId: string): Promise<void> {
  const prisma = await getPrismaClient();
  await prisma.$transaction(async (tx) => {
    // Get the domain we're setting as default
    const domain = await tx.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new Error('Domain not found');
    }

    // Unset any existing default domain for this site
    await tx.domain.updateMany({
      where: {
        site_id: domain.site_id,
        default: true,
      },
      data: {
        default: false,
      },
    });

    // Set the new default domain
    await tx.domain.update({
      where: { id: domainId },
      data: { default: true },
    });
  });
}
