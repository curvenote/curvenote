import type { Prisma } from '@curvenote/scms-db';
import { getPrismaClient } from '@curvenote/scms-server';
import { uuidv7 } from 'uuidv7';

export async function dbCollectionExists(siteName: string, where: Prisma.CollectionWhereInput) {
  const prisma = await getPrismaClient();
  const count = await prisma.collection.count({
    where: {
      site: {
        name: siteName,
      },
      ...where,
    },
  });
  return count > 0;
}

export async function dbListCollections(siteId: string, tx?: Prisma.TransactionClient) {
  const prisma = await getPrismaClient();
  return (tx ?? prisma).collection.findMany({
    where: {
      site: {
        id: siteId,
      },
    },
    include: {
      kindsInCollection: {
        include: {
          kind: true,
        },
      },
      parentCollection: {
        select: {
          id: true,
          slug: true,
        },
      },
      childCollections: {
        select: {
          id: true,
          slug: true,
          content: true,
          open: true,
          default: true,
        },
      },
      _count: {
        select: {
          submissions: {
            where: {
              versions: {
                some: {
                  status: {
                    notIn: ['DRAFT', 'INCOMPLETE'],
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      date_created: 'asc',
    },
  });
}

export async function dbCreateCollection(
  siteName: string,
  data: {
    name: string;
    slug: string;
    workflow: string;
    title: string;
    description: string | undefined;
    open: boolean;
    default: boolean;
    parent_id: string | null;
  },
  kindIds: string[],
) {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const timestamp = new Date().toISOString();

    if (data.default) {
      await tx.collection.updateMany({
        where: {
          site: {
            name: siteName,
          },
          default: true,
        },
        data: {
          date_modified: timestamp,
          default: false,
        },
      });
    }

    const collection = await tx.collection.create({
      data: {
        id: uuidv7(),
        date_created: timestamp,
        date_modified: timestamp,
        name: data.name,
        slug: data.slug,
        workflow: data.workflow,
        content: {
          title: data.title,
          description: data.description,
        },
        open: data.open,
        default: data.default,
        site: {
          connect: {
            name: siteName,
          },
        },
        parentCollection: data.parent_id
          ? {
              connect: {
                id: data.parent_id,
              },
            }
          : undefined,
      },
    });

    await tx.kindsInCollections.createMany({
      data: kindIds.map((kindId) => ({
        id: uuidv7(),
        date_created: timestamp,
        date_modified: timestamp,
        kind_id: kindId,
        collection_id: collection.id,
      })),
    });
    return collection;
  });
}
