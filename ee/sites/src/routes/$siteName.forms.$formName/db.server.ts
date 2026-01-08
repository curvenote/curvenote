import { uuidv7 as uuid } from 'uuidv7';
import { formatDate } from '@curvenote/common';
import { getPrismaClient } from '@curvenote/scms-server';
import { ActivityType } from '@prisma/client';
import { coerceToObject, httpError, delay } from '@curvenote/scms-core';

export async function dbGetForm(formName: string, siteId: string) {
  const prisma = await getPrismaClient();
  const form = await prisma.submissionForm.findFirst({
    where: {
      name: formName,
      site: {
        id: siteId,
      },
    },
    include: {
      kind: true,
      collections: {
        include: {
          collection: {
            include: {
              kindsInCollection: {
                include: {
                  kind: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!form) {
    throw httpError(404, 'Form not found');
  }
  return form;
}

/**
 * This is a server action that updates the content field of
 * a form using OCC with a parameterised number of maxretries
 */
export async function safeFormContentUpdate(
  newContent: { title?: string; description?: string },
  formId: string,
  userId: string,
  maxRetries: number = 5,
) {
  const prisma = await getPrismaClient();
  let retries = 0;
  while (retries < maxRetries) {
    // Get the current form
    const currentForm = await prisma.submissionForm.findUnique({
      where: { id: formId },
    });

    if (!currentForm) {
      throw httpError(404, 'Form not found');
    }

    const content = { ...coerceToObject(currentForm.content), ...newContent };

    // Attempt to update
    try {
      const updated = prisma.$transaction(async (tx) => {
        const timestamp = formatDate();

        const form = await tx.submissionForm.update({
          where: {
            id: formId,
          },
          data: {
            content,
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
            activity_type: ActivityType.FORM_UPDATED,
            form: {
              connect: {
                id: formId,
              },
            },
          },
        });
        return form;
      });

      return updated;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        console.log(`OCC: Could not update form ${formId} after ${maxRetries} retries`);
        throw httpError(409, `OCC: Could not update form after ${maxRetries} retries`);
      }
      console.log(`OCC Update form ${formId} Retrying... ${retries + 1}/${maxRetries}`);

      // Wait for 100ms before retrying
      await delay(100);
    }
  }
}

export async function dbUpdateFormName(name: string, formId: string, userId: string) {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const timestamp = formatDate();

    const form = await tx.submissionForm.update({
      where: {
        id: formId,
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
        activity_type: ActivityType.FORM_UPDATED,
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

export async function dbUpdateFormKind(kindId: string, formId: string, userId: string) {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const timestamp = formatDate();

    // Get current form with collections
    const currentForm = await tx.submissionForm.findUnique({
      where: { id: formId },
      include: {
        collections: {
          include: {
            collection: {
              include: {
                kindsInCollection: true,
              },
            },
          },
        },
        site: true,
      },
    });

    if (!currentForm) {
      throw httpError(404, 'Form not found');
    }

    // Update the kind
    const form = await tx.submissionForm.update({
      where: {
        id: formId,
      },
      data: {
        kind_id: kindId,
        date_modified: timestamp,
      },
    });

    // Find compatible collections for the new kind
    const compatibleCollectionIds = new Set<string>();
    const allCollections = await tx.collection.findMany({
      where: {
        site_id: currentForm.site_id,
      },
      include: {
        kindsInCollection: true,
      },
    });

    allCollections.forEach((collection) => {
      const isCompatible = collection.kindsInCollection.some(
        (kic) => kic.kind_id === kindId,
      );
      if (isCompatible) {
        compatibleCollectionIds.add(collection.id);
      }
    });

    // Get currently selected collection IDs
    const currentCollectionIds = new Set(
      currentForm.collections.map((cif) => cif.collection_id),
    );

    // Remove incompatible collections
    const collectionsToRemove: string[] = [];
    currentCollectionIds.forEach((collectionId) => {
      if (!compatibleCollectionIds.has(collectionId)) {
        collectionsToRemove.push(collectionId);
      }
    });

    if (collectionsToRemove.length > 0) {
      await tx.collectionsInForms.deleteMany({
        where: {
          form_id: formId,
          collection_id: {
            in: collectionsToRemove,
          },
        },
      });
    }

    // Note: We allow the invalid state (no collections selected) to persist
    // Users must manually select a compatible collection

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
        activity_type: ActivityType.FORM_UPDATED,
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

export async function dbCreateFormCollection(collectionId: string, formId: string, userId: string) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();
  return prisma.$transaction(async (tx) => {
    // Check if already exists
    const existing = await tx.collectionsInForms.findFirst({
      where: {
        collection_id: collectionId,
        form_id: formId,
      },
    });

    if (existing) {
      return existing;
    }

    // Add collection to form
    const collectionInForm = await tx.collectionsInForms.create({
      data: {
        id: uuid(),
        date_created: timestamp,
        date_modified: timestamp,
        collection_id: collectionId,
        form_id: formId,
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
        activity_type: ActivityType.FORM_UPDATED,
        form: {
          connect: {
            id: formId,
          },
        },
      },
    });

    return collectionInForm;
  });
}

export async function dbDeleteFormCollection(collectionId: string, formId: string, userId: string) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();
  return prisma.$transaction(async (tx) => {
    // Remove collection from form
    const deleted = await tx.collectionsInForms.deleteMany({
      where: {
        collection_id: collectionId,
        form_id: formId,
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
        activity_type: ActivityType.FORM_UPDATED,
        form: {
          connect: {
            id: formId,
          },
        },
      },
    });

    return deleted;
  });
}

export async function dbDeleteForm(formId: string, userId: string) {
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
        activity_type: ActivityType.FORM_DELETED,
        form: {
          connect: {
            id: formId,
          },
        },
      },
    });
    // Clean up CollectionsInForms
    await tx.collectionsInForms.deleteMany({
      where: {
        form_id: formId,
      },
    });
    const deleted = await tx.submissionForm.delete({
      where: {
        id: formId,
      },
    });
    return deleted;
  });
}

