import { uuidv7 as uuid } from 'uuidv7';
import { formatDate } from '@curvenote/common';
import { getPrismaClient } from '@curvenote/scms-server';
import { $Enums } from '@curvenote/scms-db';
import { coerceToObject, httpError, delay } from '@curvenote/scms-core';

/**
 * This is a server action that updates the content field of
 * a collection using OCC with a parameterised number of maxretries
 */
export async function safeCollectionContentUpdate(
  newContent: { title?: string; description?: string },
  collectionId: string,
  userId: string,
  maxRetries: number = 5,
) {
  const prisma = await getPrismaClient();
  let retries = 0;
  while (retries < maxRetries) {
    // Get the current collection with its OCC value
    const currentCollection = await prisma.collection.findUnique({
      where: { id: collectionId },
    });

    if (!currentCollection) {
      throw httpError(404, 'Collection not found');
    }

    const content = { ...coerceToObject(currentCollection.content), ...newContent };

    // Attempt to update with OCC check
    try {
      const updated = prisma.$transaction(async (tx) => {
        const timestamp = formatDate();

        const collection = tx.collection.update({
          where: {
            id: collectionId,
            occ: currentCollection.occ, // This ensures we only update if OCC matches
          },
          data: {
            content,
            occ: { increment: 1 }, // Increment OCC on successful update
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
            activity_type: $Enums.ActivityType.COLLECTION_UPDATED,
            collection: {
              connect: {
                id: collectionId,
              },
            },
          },
        });
        return collection;
      });

      return updated;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        // could not update
        console.log(`OCC: Could not update collection ${collectionId} after ${maxRetries} retries`);
        throw httpError(409, `OCC: Could not update collection after ${maxRetries} retries`);
      }
      console.log(`OCC Update collection ${collectionId} Retrying... ${retries + 1}/${maxRetries}`);

      // Wait for 100ms before retrying
      await delay(100);
    }
  }
}

export async function dbUpdateCollectionName(name: string, collectionId: string, userId: string) {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const timestamp = formatDate();

    const collection = await tx.collection.update({
      where: {
        id: collectionId,
      },
      data: {
        name,
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
        activity_type: $Enums.ActivityType.COLLECTION_UPDATED,
        collection: {
          connect: {
            id: collectionId,
          },
        },
      },
    });
    return collection;
  });
}

export async function dbUpdateCollectionDefault(
  value: boolean,
  collectionId: string,
  siteId: string,
  userId: string,
) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();
  return prisma.$transaction(async (tx) => {
    const collection = await tx.collection.update({
      where: {
        id: collectionId,
      },
      data: {
        default: value,
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
        activity_type: $Enums.ActivityType.COLLECTION_UPDATED,
        collection: {
          connect: {
            id: collectionId,
          },
        },
      },
    });
    if (value) {
      const otherCollections = await tx.collection.findMany({
        where: {
          site: {
            id: siteId,
          },
          id: {
            not: collectionId,
          },
          default: true,
        },
      });
      await Promise.all(
        otherCollections.map(async ({ id }) => {
          await tx.collection.update({
            where: {
              id,
            },
            data: {
              default: false,
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
              activity_type: $Enums.ActivityType.COLLECTION_UPDATED,
              collection: {
                connect: {
                  id,
                },
              },
            },
          });
        }),
      );
    }
    return collection;
  });
}

export async function dbCreateCollectionKind(kindId: string, collectionId: string, userId: string) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();
  return prisma.$transaction(async (tx) => {
    // Add kind to collection
    const kindInCollection = await tx.kindsInCollections.create({
      data: {
        id: uuid(),
        date_created: timestamp,
        date_modified: timestamp,
        kind_id: kindId,
        collection_id: collectionId,
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
        activity_type: $Enums.ActivityType.COLLECTION_UPDATED,
        collection: {
          connect: {
            id: collectionId,
          },
        },
        kind: {
          connect: {
            id: kindId,
          },
        },
      },
    });

    return kindInCollection;
  });
}

export async function dbDeleteCollectionKind(kindId: string, collectionId: string, userId: string) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();
  return prisma.$transaction(async (tx) => {
    // Remove kind from collection
    const deleted = await tx.kindsInCollections.deleteMany({
      where: {
        kind_id: kindId,
        collection_id: collectionId,
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
        activity_type: $Enums.ActivityType.COLLECTION_UPDATED,
        collection: {
          connect: {
            id: collectionId,
          },
        },
        kind: {
          connect: {
            id: kindId,
          },
        },
      },
    });

    return deleted;
  });
}

export async function dbUpdateCollectionOpen(value: boolean, collectionId: string, userId: string) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();
  return prisma.$transaction(async (tx) => {
    const collection = await tx.collection.update({
      where: {
        id: collectionId,
      },
      data: {
        open: value,
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
        activity_type: $Enums.ActivityType.COLLECTION_UPDATED,
        collection: {
          connect: {
            id: collectionId,
          },
        },
      },
    });

    return collection;
  });
}

export async function dbDeleteCollection(collectionId: string, userId: string) {
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
        activity_type: $Enums.ActivityType.COLLECTION_DELETED,
        collection: {
          connect: {
            id: collectionId,
          },
        },
      },
    });
    await tx.kindsInCollections.deleteMany({
      where: {
        collection_id: collectionId,
      },
    });
    const deleted = await tx.collection.delete({
      where: {
        id: collectionId,
      },
    });
    return deleted;
  });
}

export async function dbUpdateCollectionParent(
  parentId: string | null,
  collectionId: string,
  userId: string,
) {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const timestamp = formatDate();

    const collection = await tx.collection.update({
      where: {
        id: collectionId,
      },
      data: {
        parent_id: parentId,
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
        activity_type: $Enums.ActivityType.COLLECTION_UPDATED,
        collection: {
          connect: {
            id: collectionId,
          },
        },
      },
    });
    return collection;
  });
}
