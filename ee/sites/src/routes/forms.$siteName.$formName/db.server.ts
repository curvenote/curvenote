import { uuidv7 as uuid } from 'uuidv7';
import { formatDate } from '@curvenote/common';
import { getPrismaClient } from '@curvenote/scms-server';
import { ActivityType, WorkRole } from '@prisma/client';
import type { SiteContextWithUser } from '@curvenote/scms-server';
import { WorkContents } from '@curvenote/scms-core';

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

    // Create NEW_SUBMISSION activity
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

    return sv.submission;
  });

  // Create FORM_SUBMITTED activity
  await prisma.activity.create({
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
          id: submission.id,
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

  return {
    submissionId: submission.id,
    workId: work.id,
  };
}
