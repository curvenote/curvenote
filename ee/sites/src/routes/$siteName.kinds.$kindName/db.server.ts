import { uuidv7 as uuid } from 'uuidv7';
import { formatDate } from '@curvenote/common';
import { getPrismaClient } from '@curvenote/scms-server';
import { coerceToList, coerceToObject, httpError, delay } from '@curvenote/scms-core';
import { ActivityType } from '@prisma/client';
import { submissionRuleChecks, type Check } from '@curvenote/check-definitions';

/**
 * This is a server action that updates the content field of
 * a kind using OCC with a parameterised number of maxretries
 */
export async function safeKindContentUpdate(
  newContent: { title?: string; description?: string },
  kindId: string,
  userId: string,
  maxRetries: number = 5,
) {
  const prisma = await getPrismaClient();
  let retries = 0;
  while (retries < maxRetries) {
    // Get the current kind with its OCC value
    const currentKind = await prisma.submissionKind.findUnique({
      where: { id: kindId },
    });

    if (!currentKind) {
      throw httpError(404, 'Kind not found');
    }

    const content = { ...coerceToObject(currentKind.content), ...newContent };

    // Attempt to update with OCC check
    try {
      const updated = prisma.$transaction(async (tx) => {
        const timestamp = formatDate();

        const kind = tx.submissionKind.update({
          where: {
            id: kindId,
            occ: currentKind.occ, // This ensures we only update if OCC matches
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
            activity_type: ActivityType.KIND_UPDATED,
            kind: {
              connect: {
                id: kindId,
              },
            },
          },
        });
        return kind;
      });

      return updated;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        // could not update
        console.log(`OCC: Could not update kind ${kindId} after ${maxRetries} retries`);
        throw httpError(409, `OCC: Could not update kind after ${maxRetries} retries`);
      }
      console.log(`OCC Update kind ${kindId} Retrying... ${retries + 1}/${maxRetries}`);

      // Wait for 100ms before retrying
      await delay(100);
    }
  }
}

export async function dbUpdateKindName(name: string, kindId: string, userId: string) {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const timestamp = formatDate();

    const kind = await tx.submissionKind.update({
      where: {
        id: kindId,
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
        activity_type: ActivityType.KIND_UPDATED,
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

export async function dbUpdateKindDefault(
  value: boolean,
  kindId: string,
  siteId: string,
  userId: string,
) {
  const prisma = await getPrismaClient();
  return prisma.$transaction(async (tx) => {
    const timestamp = formatDate();

    const kind = await tx.submissionKind.update({
      where: {
        id: kindId,
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
        activity_type: ActivityType.KIND_UPDATED,
        kind: {
          connect: {
            id: kindId,
          },
        },
      },
    });
    if (value) {
      const otherKinds = await tx.submissionKind.findMany({
        where: {
          site: {
            id: siteId,
          },
          id: {
            not: kindId,
          },
          default: true,
        },
      });
      await Promise.all(
        otherKinds.map(async ({ id }) => {
          await tx.submissionKind.update({
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
              activity_type: ActivityType.KIND_UPDATED,
              kind: {
                connect: {
                  id,
                },
              },
            },
          });
        }),
      );
    }
    return kind;
  });
}

/**
 * Update Kind checks with OCC
 *
 * updateChecks is a function to transform current check list into new
 * check list. If this function returns null, there are no changes.
 */
export async function safeKindChecksUpdate(
  kindId: string,
  userId: string,
  updateChecks: (currentChecks: Check[]) => Check[] | null,
  maxRetries: number = 5,
) {
  const prisma = await getPrismaClient();
  let retries = 0;
  while (retries < maxRetries) {
    // Get the current kind with its OCC value
    const currentKind = await prisma.submissionKind.findUnique({
      where: { id: kindId },
    });

    if (!currentKind) {
      throw httpError(404, 'Kind not found');
    }

    const newChecks = updateChecks(coerceToList(currentKind.checks));
    if (newChecks === null) {
      return currentKind;
    }
    try {
      const updated = prisma.$transaction(async (tx) => {
        const timestamp = formatDate();

        const kind = tx.submissionKind.update({
          where: {
            id: kindId,
            occ: currentKind.occ, // This ensures we only update if OCC matches
          },
          data: {
            checks: newChecks,
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
            activity_type: ActivityType.KIND_UPDATED,
            kind: {
              connect: {
                id: kindId,
              },
            },
          },
        });
        return kind;
      });

      return updated;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        // could not update
        console.log(`OCC: Could not update kind ${kindId} after ${maxRetries} retries`);
        throw httpError(409, `OCC: Could not update kind after ${maxRetries} retries`);
      }
      console.log(`OCC Update kind ${kindId} Retrying... ${retries + 1}/${maxRetries}`);

      // Wait for 100ms before retrying
      await delay(100);
    }
  }
}

function sortByOrder(checks: Check[], order?: string[]) {
  if (!order) return checks;
  return checks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

export async function dbAddKindCheck(
  checkId: string,
  kindId: string,
  userId: string,
  order?: string[],
) {
  return safeKindChecksUpdate(kindId, userId, (currentChecks: Check[]) => {
    if (currentChecks.map(({ id }) => id).includes(checkId)) return null;
    return sortByOrder([...currentChecks, { id: checkId }], order);
  });
}

export async function dbRemoveKindCheck(
  checkId: string,
  kindId: string,
  userId: string,
  order?: string[],
) {
  return safeKindChecksUpdate(kindId, userId, (currentChecks: Check[]) => {
    if (!currentChecks.map(({ id }) => id).includes(checkId)) return null;
    return sortByOrder(
      currentChecks.filter(({ id }) => id !== checkId),
      order,
    );
  });
}

export async function dbUpdateKindCheckOption(
  checkId: string,
  optionId: string,
  value: string,
  kindId: string,
  userId: string,
) {
  return safeKindChecksUpdate(kindId, userId, (currentChecks: Check[]) => {
    const checkToUpdate = currentChecks.find(({ id }) => id === checkId);
    if (!checkToUpdate) return null;
    const optionToUpdate = submissionRuleChecks
      .find(({ id }) => id === checkId)
      ?.options?.find(({ id }) => id === optionId);
    if (!optionToUpdate) return null;
    switch (optionToUpdate.type) {
      case 'string':
        // TODO: validate max_chars
        checkToUpdate[optionId] = value;
        break;
      case 'boolean':
        checkToUpdate[optionId] = value === 'true';
        break;
      case 'number':
        // TODO: validate min/max/integer
        checkToUpdate[optionId] = +value;
        break;
      default:
        checkToUpdate[optionId] = value;
    }
    return currentChecks;
  });
}

export async function dbUpdateKindCheckOptional(
  checkId: string,
  optional: boolean,
  kindId: string,
  userId: string,
) {
  return safeKindChecksUpdate(kindId, userId, (currentChecks: Check[]) => {
    const checkToUpdate = currentChecks.find(({ id }) => id === checkId);
    if (!checkToUpdate) return null;
    checkToUpdate.optional = optional;
    return currentChecks;
  });
}
