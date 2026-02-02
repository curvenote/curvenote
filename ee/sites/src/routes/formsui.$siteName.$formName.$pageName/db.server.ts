import { uuidv7 as uuid } from 'uuidv7';
import { formatDate } from '@curvenote/common';
import { getPrismaClient, safeObjectDataUpdate } from '@curvenote/scms-server';
import { ActivityType, WorkRole } from '@curvenote/scms-db';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { WorkContents, coerceToObject } from '@curvenote/scms-core';
import { DRAFT_OBJECT_TYPE_CONST } from './draft.server.js';

/** Create a new formsui draft Object with initial field data. If createdById is provided (logged-in user), connect the user. */
export async function createDraftObject(
  initialData: Record<string, unknown>,
  createdById?: string | null,
) {
  const prisma = await getPrismaClient();
  const id = uuid();
  const now = formatDate();
  await prisma.object.create({
    data: {
      id,
      type: DRAFT_OBJECT_TYPE_CONST,
      date_created: now,
      date_modified: now,
      data: initialData as object,
      occ: 0,
      ...(createdById && { created_by: { connect: { id: createdById } } }),
    },
  });
  return id;
}

/** Load a formsui draft Object by id. Returns null if not found or wrong type. */
export async function getDraftObject(objectId: string) {
  const prisma = await getPrismaClient();
  const row = await prisma.object.findUnique({
    where: { id: objectId, type: DRAFT_OBJECT_TYPE_CONST },
  });
  return row;
}

/** Update a single field on a draft Object using OCC (safe merge, no overwrite). If createdById is provided and the object has no created_by yet, sets created_by. */
export async function updateDraftObjectField(
  objectId: string,
  fieldName: string,
  value: unknown,
  createdById?: string | null,
): Promise<void> {
  await safeObjectDataUpdate(objectId, (data) => ({
    ...coerceToObject(data),
    [fieldName]: value,
  }));

  if (createdById) {
    const prisma = await getPrismaClient();
    await (prisma.object as any).updateMany({
      where: {
        id: objectId,
        type: DRAFT_OBJECT_TYPE_CONST,
        created_by_id: null,
      },
      data: { created_by_id: createdById },
    });
  }
}

interface SubmitFormData {
  name: string;
  email: string;
  orcid?: string;
  affiliation?: string;
  collectionId: string;
  workTitle: string;
  workDescription?: string;
  authors: string[];
}

async function dbCreateWork(
  ctx: SiteContextWithUser,
  title: string,
  description: string,
  authors: string[],
  contains: WorkContents[],
) {
  const date_created = formatDate();
  const prisma = await getPrismaClient();
  const workId = uuid();
  const workVersionId = uuid();

  // Get CDN from config (same as StorageBackend does)
  const cdn = ctx.$config.api.knownBucketInfoMap.prv.cdn;
  const cdnKey = uuid();

  return prisma.$transaction(async (tx) => {
    // Create the work
    const newWork = await tx.work.create({
      data: {
        id: workId,
        date_created,
        date_modified: date_created,
        contains,
        created_by: {
          connect: {
            id: ctx.user.id,
          },
        },
        versions: {
          create: [
            {
              id: workVersionId,
              date_created,
              date_modified: date_created,
              cdn,
              cdn_key: cdnKey,
              title,
              description: description || null,
              draft: false,
              authors,
              metadata: {},
            },
          ],
        },
        work_users: {
          create: [
            {
              id: uuid(),
              date_created,
              date_modified: date_created,
              user_id: ctx.user.id,
              role: WorkRole.OWNER,
            },
          ],
        },
      },
      include: {
        versions: true,
      },
    });

    // Create activity record
    await tx.activity.create({
      data: {
        id: uuid(),
        date_created,
        date_modified: date_created,
        activity_by: {
          connect: {
            id: ctx.user.id,
          },
        },
        activity_type: ActivityType.NEW_WORK,
        work: {
          connect: {
            id: workId,
          },
        },
        work_version: {
          connect: {
            id: workVersionId,
          },
        },
      },
    });

    return newWork;
  });
}

export async function dbSubmitForm(ctx: SiteContextWithUser, form: any, data: SubmitFormData) {
  const prisma = await getPrismaClient();
  const timestamp = formatDate();

  // Create or get user for submission
  // For logged-in users, use existing user; for anonymous, we might need to create a guest user
  // For now, we'll use the context user (which should exist since we require authentication)
  const submitter = ctx.user;

  // Create work and work version
  const work = await dbCreateWork(ctx, data.workTitle, data.workDescription || '', data.authors, [
    WorkContents.MYST,
  ]);

  const workVersion = work.versions[0];

  // Create submission and submission version
  const date_created = formatDate();
  const submissionVersionId = uuid();
  const submission = await prisma.$transaction(async (tx) => {
    const sv = await tx.submissionVersion.create({
      data: {
        id: submissionVersionId,
        date_created,
        date_modified: date_created,
        submitted_by: {
          connect: {
            id: submitter.id,
          },
        },
        status: 'PENDING',
        work_version: {
          connect: {
            id: workVersion.id,
          },
        },
        submission: {
          create: {
            id: uuid(),
            date_created,
            date_modified: date_created,
            submitted_by: {
              connect: {
                id: submitter.id,
              },
            },
            kind: {
              connect: {
                id: form.kind_id,
              },
            },
            collection: {
              connect: {
                id: data.collectionId,
              },
            },
            site: {
              connect: {
                name: ctx.site.name,
              },
            },
            work: {
              connect: {
                id: work.id,
              },
            },
          },
        },
      },
      include: {
        submission: true,
      },
    });

    await tx.activity.create({
      data: {
        id: uuid(),
        date_created,
        date_modified: date_created,
        activity_by: {
          connect: {
            id: submitter.id,
          },
        },
        submission: {
          connect: {
            id: sv.submission.id,
          },
        },
        submission_version: {
          connect: {
            id: sv.id,
          },
        },
        activity_type: ActivityType.NEW_SUBMISSION,
        status: sv.status,
        work_version: {
          connect: {
            id: workVersion.id,
          },
        },
        kind: {
          connect: {
            id: form.kind_id,
          },
        },
      },
    });

    await tx.activity.create({
      data: {
        id: uuid(),
        date_created: timestamp,
        date_modified: timestamp,
        activity_by: {
          connect: {
            id: submitter.id,
          },
        },
        activity_type: ActivityType.FORM_SUBMITTED,
        form: {
          connect: {
            id: form.id,
          },
        },
        submission: {
          connect: {
            id: sv.submission.id,
          },
        },
        submission_version: {
          connect: {
            id: submissionVersionId,
          },
        },
        work: {
          connect: {
            id: work.id,
          },
        },
        work_version: {
          connect: {
            id: workVersion.id,
          },
        },
      },
    });

    return sv.submission;
  });

  return {
    submissionId: submission.id,
    workId: work.id,
  };
}
