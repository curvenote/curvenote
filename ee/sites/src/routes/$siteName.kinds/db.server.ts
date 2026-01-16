import { uuidv7 as uuid } from 'uuidv7';
import { formatDate } from '@curvenote/common';
import { getPrismaClient, sites } from '@curvenote/scms-server';
import { $Enums } from '@curvenote/scms-db';

export async function dbDeleteKind(kindId: string, siteId: string, userId: string) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();
  return prisma.$transaction(async (tx) => {
    await tx.activity.create({
      data: {
        id: uuid(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by: {
          connect: {
            id: userId,
          },
        },
        activity_type: $Enums.ActivityType.KIND_DELETED,
        kind: {
          connect: {
            id: kindId,
          },
        },
      },
    });
    const deleted = await tx.submissionKind.delete({
      where: {
        id: kindId,
      },
    });
    if (deleted.default) {
      const newDefault = await tx.submissionKind.findFirst({
        where: {
          site: {
            id: siteId,
          },
        },
      });
      if (newDefault) {
        await tx.submissionKind.update({
          where: {
            id: newDefault.id,
          },
          data: {
            default: true,
            date_modified: timestamp,
          },
        });
        await tx.activity.create({
          data: {
            id: uuid(),
            date_created: timestamp,
            date_modified: timestamp,
            activity_by: {
              connect: {
                id: userId,
              },
            },
            activity_type: $Enums.ActivityType.KIND_UPDATED,
            kind: {
              connect: {
                id: newDefault.id,
              },
            },
          },
        });
      }
    }
    return deleted;
  });
}

export async function dbCreateKind(
  data: {
    name: string;
    title: string;
    description?: string;
    default?: boolean;
    checks?: { id: string }[];
  },
  siteId: string,
  userId: string,
) {
  const prisma = await getPrismaClient();
  const kindId = uuid();
  return prisma.$transaction(async (tx) => {
    const timestamp = formatDate();

    if (data.default) {
      await tx.submissionKind.updateMany({
        where: {
          site: {
            id: siteId,
          },
        },
        data: {
          default: false,
        },
      });
    }
    const kind = tx.submissionKind.create({
      data: {
        id: kindId,
        site: {
          connect: {
            id: siteId,
          },
        },
        name: data.name,
        content: {
          title: data.title,
          description: data.description,
        },
        default: data.default ?? false,
        checks: data.checks ?? sites.DEFAULT_CHECKS,
        date_created: timestamp,
        date_modified: timestamp,
      },
    });
    tx.activity.create({
      data: {
        id: uuid(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by: {
          connect: {
            id: userId,
          },
        },
        activity_type: $Enums.ActivityType.KIND_CREATED,
        kind: {
          connect: {
            id: kindId,
          },
        },
      },
    });
    return kind;
  });
}
