import { uuidv7 as uuid } from 'uuidv7';
import { formatDate } from '@curvenote/common';
import { getPrismaClient } from '@curvenote/scms-server';
import { ActivityType, WorkRole } from '@curvenote/scms-db';
import type { SiteContext, MyUserDBO } from '@curvenote/scms-server';

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

export async function dbCreateWorkAndSubmission(
  ctx: SiteContext,
  submitter: MyUserDBO,
  form: any,
  data: SubmitFormData,
) {
  const prisma = await getPrismaClient();
  const date_created = formatDate();
  const timestamp = formatDate();
  const workId = uuid();
  const workVersionId = uuid();
  const submissionId = uuid();
  const submissionVersionId = uuid();

  // Get CDN from config (same as StorageBackend does)
  const cdn = ctx.$config.api.knownBucketInfoMap.prv.cdn;
  const cdnKey = uuid();

  return prisma.$transaction(async (tx) => {
    // Create the work and work version
    const newWork = await tx.work.create({
      data: {
        id: workId,
        date_created,
        date_modified: date_created,
        contains: [], // [WorkContents.MYST],
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

    // Create activity record for NEW_WORK
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

    // Create submission and submission version
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

    // Create activity record for NEW_SUBMISSION
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

    // Create activity record for FORM_SUBMITTED
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

    return {
      submissionId: sv.submission.id,
      workId: workId,
    };
  });
}
