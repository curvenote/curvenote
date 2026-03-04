import { uuidv7 as uuid } from 'uuidv7';
import { formatDate } from '@curvenote/common';
import { getPrismaClient, safeObjectDataUpdate } from '@curvenote/scms-server';
import { ActivityType, WorkRole } from '@curvenote/scms-db';
import type { SiteContext, MyUserDBO } from '@curvenote/scms-server';
import { coerceToObject } from '@curvenote/scms-core';
import { FORM_METADATA_FIELDS_SCHEMA } from '../../schemas.js';
import { DRAFT_OBJECT_TYPE_CONST } from './cookies.server.js';

/** Create a new forms draft Object with initial field data. If createdById is provided (logged-in user), connect the user. */
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
      data: {
        ...(initialData as object),
        $schema: FORM_METADATA_FIELDS_SCHEMA,
      },
      occ: 0,
      ...(createdById && { created_by: { connect: { id: createdById } } }),
    },
  });
  return id;
}

/** Load a forms draft Object by id. Returns null if not found or wrong type. */
export async function getDraftObject(objectId: string) {
  const prisma = await getPrismaClient();
  const row = await prisma.object.findUnique({
    where: { id: objectId, type: DRAFT_OBJECT_TYPE_CONST },
  });
  return row;
}

/** Returns workId if the work exists and is owned by the given user (created_by_id). Otherwise null. */
export async function getWorkIdIfOwnedByUser(
  workId: string,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const prisma = await getPrismaClient();
  const work = await prisma.work.findUnique({
    where: { id: workId },
    select: { created_by_id: true },
  });
  return work?.created_by_id === userId ? workId : null;
}

/** Update a single field on a draft Object using OCC (safe merge, no overwrite). If createdById is provided and the object has no created_by yet, sets created_by. */
export async function updateDraftObjectField(
  objectId: string,
  fieldName: string,
  value: unknown,
  createdById?: string | null,
): Promise<void> {
  await safeObjectDataUpdate(objectId, (data) => {
    const base = coerceToObject(data);
    return {
      ...base,
      [fieldName]: value,
      $schema: FORM_METADATA_FIELDS_SCHEMA,
    };
  });

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

export interface SubmitFormData {
  name: string;
  email: string;
  orcid?: string;
  affiliation?: string;
  collectionId: string;
  workTitle: string;
  workDescription?: string;
  authors: string[];
  /** Form-defined fields (keywords, format, license, etc.) stored in work version metadata. */
  formMetadata?: Record<string, unknown>;
}

/** Create work and submission in one transaction (same as forms route). If draftObjectId is provided, deletes the draft Object in the same transaction. */
export async function dbCreateWorkAndSubmission(
  ctx: SiteContext,
  submitter: MyUserDBO,
  form: any,
  data: SubmitFormData,
  draftObjectId?: string | null,
) {
  const prisma = await getPrismaClient();
  const date_created = formatDate();
  const timestamp = formatDate();
  const workId = uuid();
  const workVersionId = uuid();
  const submissionId = uuid();
  const submissionVersionId = uuid();

  const cdn = ctx.$config.api.knownBucketInfoMap.prv.cdn;
  const cdnKey = uuid();

  return prisma.$transaction(async (tx) => {
    const newWork = await tx.work.create({
      data: {
        id: workId,
        date_created,
        date_modified: date_created,
        contains: [],
        created_by: {
          connect: {
            id: submitter.id,
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
              title: data.workTitle,
              description: data.workDescription || null,
              draft: false,
              authors: data.authors,
              metadata: {
                fields: {
                  ...(data.formMetadata ?? {}),
                  $schema: FORM_METADATA_FIELDS_SCHEMA,
                },
              } as object,
            },
          ],
        },
        work_users: {
          create: [
            {
              id: uuid(),
              date_created,
              date_modified: date_created,
              user_id: submitter.id,
              role: WorkRole.OWNER,
            },
          ],
        },
      },
      include: {
        versions: true,
      },
    });

    const workVersion = newWork.versions[0];

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
            id: submissionId,
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
                id: workId,
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
            id: workId,
          },
        },
        work_version: {
          connect: {
            id: workVersion.id,
          },
        },
      },
    });

    if (draftObjectId) {
      await tx.object.deleteMany({
        where: { id: draftObjectId, type: DRAFT_OBJECT_TYPE_CONST },
      });
    }

    return {
      submissionId: sv.submission.id,
      workId: workId,
    };
  });
}
