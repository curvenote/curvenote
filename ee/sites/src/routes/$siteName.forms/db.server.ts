import { uuidv7 as uuid } from 'uuidv7';
import { formatDate } from '@curvenote/common';
import { getPrismaClient } from '@curvenote/scms-server';
import { ActivityType } from '@prisma/client';

export async function dbListForms(siteId: string) {
  const prisma = await getPrismaClient();
  return prisma.submissionForm.findMany({
    where: {
      site: {
        id: siteId,
      },
    },
    include: {
      kind: true,
      collections: {
        include: {
          collection: true,
        },
      },
    },
    orderBy: {
      date_created: 'asc',
    },
  });
}

export async function dbFormExists(siteId: string, name: string) {
  const prisma = await getPrismaClient();
  const count = await prisma.submissionForm.count({
    where: {
      site: {
        id: siteId,
      },
      name,
    },
  });
  return count > 0;
}

export async function dbCreateForm(
  data: {
    name: string;
    title: string;
    description?: string;
    kindId: string;
    collectionIds: string[];
  },
  siteId: string,
  userId: string,
) {
  const prisma = await getPrismaClient();
  const formId = uuid();
  return prisma.$transaction(async (tx) => {
    const timestamp = formatDate();

    const form = await tx.submissionForm.create({
      data: {
        id: formId,
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
        kind: {
          connect: {
            id: data.kindId,
          },
        },
        date_created: timestamp,
        date_modified: timestamp,
      },
    });

    if (data.collectionIds.length > 0) {
      await tx.collectionsInForms.createMany({
        data: data.collectionIds.map((collectionId) => ({
          id: uuid(),
          date_created: timestamp,
          date_modified: timestamp,
          collection_id: collectionId,
          form_id: formId,
        })),
      });
    }

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
        activity_type: ActivityType.FORM_CREATED,
        form: {
          connect: {
            id: formId,
          },
        },
      },
    });

    return form;
  });
}
